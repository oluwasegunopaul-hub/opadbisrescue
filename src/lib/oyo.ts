// Nigeria bounding box (approximate) and centre.
export const OYO_BBOX = {
  south: 4.0,
  west: 2.6,
  north: 14.0,
  east: 14.7,
};

export const OYO_CENTER: [number, number] = [9.08, 8.68];

export type BBox = { south: number; west: number; north: number; east: number };

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
};

import { runOverpass } from "./overpass.functions";

export async function overpass(query: string): Promise<OverpassElement[]> {
  const body = `[out:json][timeout:60];\n${query}`;
  const res = await runOverpass({ data: { query: body } });
  return res.elements as OverpassElement[];
}

// ---------- Bbox helpers ----------
export function bboxStr(b: BBox): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

/** Quantize a bbox so nearby viewports share a cache key. */
export function quantizeBbox(b: BBox, precision = 2): string {
  const q = (n: number) => n.toFixed(precision);
  return `${q(b.south)},${q(b.west)},${q(b.north)},${q(b.east)}`;
}

/** Rough area in square degrees — used to reject too-large viewports. */
export function bboxAreaDeg(b: BBox): number {
  return Math.max(0, (b.north - b.south) * (b.east - b.west));
}

// ---------- Layer catalogue ----------
export type LayerKey =
  | "hospitals"
  | "clinics"
  | "pharmacies"
  | "healthCentres"
  | "doctors"
  | "emergency"
  | "settlements"
  | "transport"
  | "roads"
  | "buildings";

/** Minimum map zoom at which each layer starts requesting data. */
export const LAYER_MIN_ZOOM: Record<LayerKey, number> = {
  settlements: 6,
  roads: 8,
  hospitals: 8,
  emergency: 8,
  clinics: 9,
  healthCentres: 9,
  transport: 10,
  pharmacies: 11,
  doctors: 11,
  buildings: 15,
};

/** Max bbox area (deg²) allowed per layer to keep Overpass responsive. */
export const LAYER_MAX_AREA: Record<LayerKey, number> = {
  settlements: 40,
  roads: 20,
  hospitals: 25,
  emergency: 25,
  clinics: 15,
  healthCentres: 15,
  transport: 10,
  pharmacies: 6,
  doctors: 6,
  buildings: 0.05,
};

/** Build an Overpass body (without the header) for a given layer + bbox. */
export function buildLayerQuery(layer: LayerKey, b: BBox): string {
  const bb = bboxStr(b);
  switch (layer) {
    case "hospitals":
      return `(node["amenity"="hospital"](${bb});way["amenity"="hospital"](${bb});node["healthcare"="hospital"](${bb});way["healthcare"="hospital"](${bb}););out center tags;`;
    case "clinics":
      return `(node["amenity"="clinic"](${bb});way["amenity"="clinic"](${bb});node["healthcare"="clinic"](${bb});way["healthcare"="clinic"](${bb}););out center tags;`;
    case "pharmacies":
      return `(node["amenity"="pharmacy"](${bb});way["amenity"="pharmacy"](${bb});node["healthcare"="pharmacy"](${bb}););out center tags;`;
    case "healthCentres":
      return `(node["healthcare"~"centre|center"](${bb});way["healthcare"~"centre|center"](${bb}););out center tags;`;
    case "doctors":
      return `(node["amenity"="doctors"](${bb});node["healthcare"="doctor"](${bb}););out center tags;`;
    case "emergency":
      return `(node["emergency"="ambulance_station"](${bb});way["emergency"="ambulance_station"](${bb}););out center tags;`;
    case "settlements":
      return `(node["place"~"city|town"](${bb}););out tags;`;
    case "transport":
      return `(node["aeroway"="aerodrome"](${bb});node["railway"="station"](${bb});node["amenity"="fuel"](${bb}););out center tags;`;
    case "roads":
      // Progressive: at low zoom, only motorway/trunk; at higher zoom add primary/secondary.
      return `(way["highway"~"motorway|trunk|primary|secondary"](${bb}););out geom tags;`;
    case "buildings":
      return `(way["building"](${bb}););out geom tags;`;
  }
}

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function elementCoords(el: OverpassElement): [number, number] | null {
  if (el.lat != null && el.lon != null) return [el.lat, el.lon];
  if (el.center) return [el.center.lat, el.center.lon];
  return null;
}

/**
 * One combined Overpass request covering every dashboard layer (buildings excluded —
 * far too heavy for an LGA/state extent). Used when a study area is selected so all
 * datasets arrive together in a single round-trip.
 */
export function buildBundleQuery(b: BBox): string {
  const bb = bboxStr(b);
  return (
    `(` +
    `node["amenity"~"^(hospital|clinic|pharmacy|doctors)$"](${bb});` +
    `way["amenity"~"^(hospital|clinic|pharmacy)$"](${bb});` +
    `node["healthcare"](${bb});` +
    `way["healthcare"](${bb});` +
    `node["emergency"="ambulance_station"](${bb});` +
    `way["emergency"="ambulance_station"](${bb});` +
    `node["place"~"city|town"](${bb});` +
    `node["aeroway"="aerodrome"](${bb});` +
    `node["railway"="station"](${bb});` +
    `node["amenity"="fuel"](${bb});` +
    `);out center tags;` +
    `(way["highway"~"motorway|trunk|primary|secondary"](${bb}););out geom tags;`
  );
}

/** Map a bundled element back to the layer it belongs to. */
export function layerOfElement(el: OverpassElement): LayerKey | null {
  const t = el.tags || {};
  if (t.highway) return "roads";
  if (t.emergency === "ambulance_station") return "emergency";
  if (t.amenity === "hospital" || t.healthcare === "hospital") return "hospitals";
  if (t.amenity === "clinic" || t.healthcare === "clinic") return "clinics";
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") return "pharmacies";
  if (t.healthcare === "centre" || t.healthcare === "center") return "healthCentres";
  if (t.amenity === "doctors" || t.healthcare === "doctor") return "doctors";
  if (t.place === "city" || t.place === "town") return "settlements";
  if (t.aeroway === "aerodrome" || t.railway === "station" || t.amenity === "fuel")
    return "transport";
  if (t.healthcare) return "healthCentres";
  return null;
}
