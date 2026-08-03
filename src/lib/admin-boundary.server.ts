import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";

const UA = "opadbisrescue GIS Dashboard/1.0 (OpenStreetMap boundary viewer)";

type NominatimHit = {
  display_name?: string;
  class?: string;
  type?: string;
  osm_type?: string;
  geojson?: Polygon | MultiPolygon | { type: string; coordinates: unknown };
};

async function nominatim(query: string): Promise<Polygon | MultiPolygon | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=8&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return null;
  const hits = (await res.json()) as NominatimHit[];
  const poly = hits.find(
    (h) =>
      (h.geojson?.type === "Polygon" || h.geojson?.type === "MultiPolygon") &&
      (h.class === "boundary" || h.osm_type === "relation"),
  );
  return (poly?.geojson as Polygon | MultiPolygon | undefined) ?? null;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassRel = {
  type: string;
  tags?: Record<string, string>;
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
};

async function overpassBoundary(
  name: string,
  adminLevel: 4 | 6,
): Promise<Polygon | MultiPolygon | null> {
  const q = `[out:json][timeout:50];area["ISO3166-1"="NG"][admin_level=2]->.ng;relation(area.ng)["boundary"="administrative"]["admin_level"="${adminLevel}"]["name"~"^${name.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}$",i];out geom;`;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": UA,
        },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassRel[] };
      const rel = json.elements?.find((e) => e.type === "relation" && e.members?.length);
      if (!rel) continue;
      const rings = stitchRings(rel.members ?? []);
      if (!rings.length) continue;
      return rings.length === 1
        ? { type: "Polygon", coordinates: [rings[0]] }
        : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
    } catch {
      continue;
    }
  }
  return null;
}

/** Join relation member ways (outer role) into closed rings. */
function stitchRings(
  members: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[],
): Position[][] {
  const segs: Position[][] = members
    .filter((m) => m.type === "way" && m.role !== "inner" && (m.geometry?.length ?? 0) > 1)
    .map((m) => m.geometry!.map((g) => [g.lon, g.lat] as Position));

  const rings: Position[][] = [];
  const used = new Set<number>();
  const same = (a: Position, b: Position) =>
    Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;

  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const ring = [...segs[i]];
    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < segs.length; j++) {
        if (used.has(j)) continue;
        const s = segs[j];
        const end = ring[ring.length - 1];
        if (same(end, s[0])) {
          ring.push(...s.slice(1));
        } else if (same(end, s[s.length - 1])) {
          ring.push(...[...s].reverse().slice(1));
        } else continue;
        used.add(j);
        extended = true;
      }
    }
    if (ring.length > 3) {
      if (!same(ring[0], ring[ring.length - 1])) ring.push(ring[0]);
      rings.push(ring);
    }
  }
  return rings.sort((a, b) => b.length - a.length);
}

/** Resolve an ADM1 (state) or ADM2 (LGA) boundary to a GeoJSON FeatureCollection. */
export async function fetchAdminBoundary(
  state: string,
  lga: string | null,
): Promise<FeatureCollection> {
  const level: 4 | 6 = lga ? 6 : 4;
  const label = lga ? `${lga}, ${state} State, Nigeria` : `${state} State, Nigeria`;

  let geom: Polygon | MultiPolygon | null = null;
  try {
    geom = await nominatim(label);
  } catch {
    geom = null;
  }
  if (!geom && lga) {
    try {
      geom = await nominatim(`${lga} Local Government Area, ${state}, Nigeria`);
    } catch {
      geom = null;
    }
  }
  if (!geom) geom = await overpassBoundary(lga ?? state, level);
  if (!geom) throw new Error(`No administrative boundary found for ${label}.`);

  const feature: Feature = {
    type: "Feature",
    geometry: geom,
    properties: { name: lga ?? state, state, level: lga ? "ADM2" : "ADM1" },
  };
  return { type: "FeatureCollection", features: [feature] };
}
