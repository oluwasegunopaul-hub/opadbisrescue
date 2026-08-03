import { runOverpass } from "./overpass.functions";
import { haversine, elementCoords, type OverpassElement } from "./oyo";
import type { NearestCategory, NearestHit, NearestResults } from "./store";

export const SEARCH_RADII_M = [5000, 10000, 25000, 50000];

function classify(el: OverpassElement): NearestCategory | null {
  const t = el.tags || {};
  if (t.emergency === "ambulance_station") return "ambulance";
  if (t.amenity === "hospital" || t.healthcare === "hospital") return "hospital";
  if (
    t.amenity === "clinic" ||
    t.healthcare === "clinic" ||
    t.healthcare === "centre" ||
    t.healthcare === "center"
  )
    return "clinic";
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") return "pharmacy";
  return null;
}

function buildAroundQuery(lat: number, lng: number, radius: number): string {
  const a = `around:${radius},${lat},${lng}`;
  return `[out:json][timeout:30];(
    nwr["amenity"~"^(hospital|clinic|pharmacy)$"](${a});
    nwr["healthcare"~"^(hospital|clinic|pharmacy|centre|center)$"](${a});
    nwr["emergency"="ambulance_station"](${a});
  );out center tags;`;
}

/** Fetch nearby healthcare facilities using expanding radii until each category has a hit or max reached. */
export async function findNearestFacilities(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ results: NearestResults; radiusUsed: number; total: number }> {
  const seen = new Map<string, OverpassElement>();
  const results: NearestResults = {};
  let radiusUsed = 0;

  for (const radius of SEARCH_RADII_M) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    radiusUsed = radius;
    const query = buildAroundQuery(lat, lng, radius);
    const res = await runOverpass({ data: { query } });
    for (const el of (res.elements ?? []) as OverpassElement[]) {
      const key = `${el.type}/${el.id}`;
      if (seen.has(key)) continue;
      seen.set(key, el);
    }

    // Compute nearest per category from everything seen so far.
    for (const el of seen.values()) {
      const cat = classify(el);
      if (!cat) continue;
      const c = elementCoords(el);
      if (!c) continue;
      const d = haversine([lat, lng], c);
      const prev = results[cat];
      if (!prev || d < prev.distanceKm) {
        results[cat] = { category: cat, element: el, coords: c, distanceKm: d };
      }
    }

    const needed: NearestCategory[] = ["hospital", "clinic", "pharmacy", "ambulance"];
    if (needed.every((c) => results[c])) break;
  }

  return { results, radiusUsed, total: seen.size };
}

export type RouteMode = "driving" | "walking" | "cycling";
export type RoutePreference = "fastest" | "shortest";

export type RouteStep = {
  instruction: string;
  distanceM: number;
  durationS: number;
  name: string;
  type: string;
  modifier?: string;
  location: [number, number]; // [lat, lng] maneuver point
};

export type RouteResult = {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
};

function humanizeStep(m: { type: string; modifier?: string }, name: string, distanceM: number): string {
  const road = name ? ` onto ${name}` : "";
  const dist = distanceM > 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`;
  switch (m.type) {
    case "depart":
      return `Head ${m.modifier ?? "straight"}${road}`;
    case "arrive":
      return "You have arrived at your destination";
    case "turn":
      return `Turn ${m.modifier ?? ""}${road}`.trim();
    case "new name":
      return `Continue${road} for ${dist}`;
    case "continue":
      return `Continue ${m.modifier ?? "straight"}${road}`;
    case "merge":
      return `Merge ${m.modifier ?? ""}${road}`.trim();
    case "on ramp":
      return `Take the ramp${road}`;
    case "off ramp":
      return `Take the exit${road}`;
    case "fork":
      return `Keep ${m.modifier ?? "straight"}${road}`;
    case "end of road":
      return `At the end of the road, turn ${m.modifier ?? ""}${road}`.trim();
    case "roundabout":
    case "rotary":
      return `Enter the roundabout${road}`;
    default:
      return `${m.type}${m.modifier ? ` ${m.modifier}` : ""}${road}`;
  }
}

/** Fetch a route from OSRM public router. Returns polyline + duration/distance + turn-by-turn steps. */
export async function fetchOsrmRoute(
  from: [number, number],
  to: [number, number],
  mode: RouteMode = "driving",
  signal?: AbortSignal,
  opts?: { alternatives?: boolean; preference?: RoutePreference },
): Promise<RouteResult & { alternatives: RouteResult[] }> {
  const profile = mode === "walking" ? "foot" : mode === "cycling" ? "bike" : "driving";
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    alternatives: opts?.alternatives ? "true" : "false",
    annotations: "false",
  });
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?${params}`;
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const j = (await r.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
      legs?: Array<{
        steps?: Array<{
          distance: number;
          duration: number;
          name: string;
          maneuver: { type: string; modifier?: string; location: [number, number] };
        }>;
      }>;
    }>;
  };
  const routes = j.routes ?? [];
  if (!routes.length) throw new Error("No route found");

  const toResult = (route: (typeof routes)[number]): RouteResult => {
    const steps: RouteStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        steps.push({
          instruction: humanizeStep(s.maneuver, s.name, s.distance),
          distanceM: s.distance,
          durationS: s.duration,
          name: s.name || "",
          type: s.maneuver.type,
          modifier: s.maneuver.modifier,
          location: [s.maneuver.location[1], s.maneuver.location[0]],
        });
      }
    }
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      steps,
    };
  };

  const all = routes.map(toResult);
  let primary = all[0];
  if (opts?.preference === "shortest" && all.length > 1) {
    primary = [...all].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  }
  return { ...primary, alternatives: all };
}

export function facilityName(el: OverpassElement): string {
  return el.tags?.name || el.tags?.["name:en"] || "Unnamed facility";
}
