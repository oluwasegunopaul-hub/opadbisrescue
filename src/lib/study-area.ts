import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from "geojson";
import type { BBox } from "./oyo";

export type StudyArea = {
  /** Display name, e.g. "Ibadan North" */
  name: string;
  /** Parent state, e.g. "Oyo" */
  state: string;
  /** "ADM1" for a state, "ADM2" for an LGA */
  level: "ADM1" | "ADM2";
  /** Simplified geometry for map rendering */
  geojson: FeatureCollection;
  /** Full-precision geometry for spatial analysis */
  precise: FeatureCollection;
  bbox: BBox;
  featureCount: number;
  /** Boundary area in km² */
  areaKm2: number;
  /** Flattened rings for fast point-in-polygon testing: [ [ring, ...holes], ... ] as [lng,lat][] */
  rings: number[][][][];
};

/** Build a StudyArea from an administrative boundary FeatureCollection. */
export function studyAreaFromCollection(
  fc: FeatureCollection,
  meta: { name: string; state: string; level: "ADM1" | "ADM2" },
): StudyArea {
  const polygons = fc.features.filter(
    (f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
  ) as Feature[];
  if (!polygons.length) throw new Error("The boundary contains no polygon geometry.");

  const precise: FeatureCollection = { type: "FeatureCollection", features: polygons };
  const bbox = collectionBbox(precise);
  if (!isFinite(bbox.south)) throw new Error("Could not compute a bounding box for the boundary.");

  const rings = polygons.map((f) => geometryRings(f.geometry as Polygon | MultiPolygon)).flat();

  return {
    ...meta,
    precise,
    geojson: simplifyCollection(precise, toleranceFor(bbox)),
    bbox,
    featureCount: polygons.length,
    areaKm2: ringsAreaKm2(rings),
    rings,
  };
}

function geometryRings(g: Polygon | MultiPolygon): number[][][][] {
  return g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
}

export function collectionBbox(fc: FeatureCollection): BBox {
  let south = Infinity,
    west = Infinity,
    north = -Infinity,
    east = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      const [lng, lat] = c as number[];
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      return;
    }
    if (Array.isArray(c)) c.forEach(walk);
  };
  for (const f of fc.features) if (f.geometry) walk((f.geometry as { coordinates?: unknown }).coordinates);
  return { south, west, north, east };
}

// ---------- Simplification (Douglas–Peucker) ----------

function toleranceFor(b: BBox): number {
  const span = Math.max(b.north - b.south, b.east - b.west);
  return Math.max(span / 2000, 0.00005);
}

function perpDist(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const cx = a[0] + Math.max(0, Math.min(1, t)) * dx;
  const cy = a[1] + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

function simplifyRing(points: number[][], tol: number): number[][] {
  if (points.length < 5) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : points;
}

function simplifyCollection(fc: FeatureCollection, tol: number): FeatureCollection {
  const mapRings = (rings: number[][][]) => rings.map((r) => simplifyRing(r, tol));
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => {
      const g = f.geometry as Polygon | MultiPolygon;
      const geometry: Geometry =
        g.type === "Polygon"
          ? { type: "Polygon", coordinates: mapRings(g.coordinates as number[][][]) }
          : {
              type: "MultiPolygon",
              coordinates: (g.coordinates as number[][][][]).map(mapRings),
            };
      return { ...f, geometry };
    }),
  };
}

// ---------- Area ----------

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

function ringAreaKm2(ring: number[][]): number {
  let total = 0;
  for (let i = 0, len = ring.length; i < len; i++) {
    const [lo1, la1] = ring[i];
    const [lo2, la2] = ring[(i + 1) % len];
    total += (rad(lo2) - rad(lo1)) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
  }
  return Math.abs((total * R * R) / 2);
}

function ringsAreaKm2(polys: number[][][][]): number {
  let area = 0;
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      area += i === 0 ? ringAreaKm2(ring) : -ringAreaKm2(ring);
    });
  }
  return Math.max(0, area);
}

// ---------- Point in polygon ----------

function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True when [lat,lng] falls inside the study area polygons (holes respected). */
export function pointInStudyArea(area: StudyArea, lat: number, lng: number): boolean {
  if (lat < area.bbox.south || lat > area.bbox.north || lng < area.bbox.west || lng > area.bbox.east) return false;
  for (const poly of area.rings) {
    if (!poly.length) continue;
    if (!pointInRing(lat, lng, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(lat, lng, poly[h])) inHole = true;
    if (!inHole) return true;
  }
  return false;
}
