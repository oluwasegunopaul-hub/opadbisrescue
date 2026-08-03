import type { OverpassElement } from "./oyo";
import { elementCoords, haversine } from "./oyo";

export type QualityBand = "excellent" | "good" | "needs" | "critical";

export type QualityIssue = {
  key: string;
  label: string;
  severity: "info" | "warn" | "critical";
  suggestion: string;
  osmTags?: string[];
};

export type FacilityScore = {
  element: OverpassElement;
  coords: [number, number] | null;
  facilityType: string;
  score: number;
  band: QualityBand;
  breakdown: {
    attributes: number;
    contact: number;
    address: number;
    consistency: number;
    geometry: number;
  };
  addressCompleteness: number;
  missingTags: string[];
  issues: QualityIssue[];
  name: string;
  unnamed: boolean;
};

export type DuplicatePair = {
  a: FacilityScore;
  b: FacilityScore;
  distanceM: number;
  nameSimilarity: number;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type QualityAggregate = {
  total: number;
  complete: number;
  incomplete: number;
  unnamed: number;
  missingPhone: number;
  missingHours: number;
  missingAddress: number;
  duplicateCandidates: number;
  disconnected: number;
  overall: number;
  band: QualityBand;
  byType: Record<string, { total: number; avgScore: number }>;
  byState: Record<string, { total: number; avgScore: number }>;
  topIssues: { key: string; label: string; count: number }[];
};

export function facilityType(el: OverpassElement): string {
  const t = el.tags || {};
  if (t.amenity === "hospital" || t.healthcare === "hospital") return "hospital";
  if (t.amenity === "clinic" || t.healthcare === "clinic") return "clinic";
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") return "pharmacy";
  if (t.healthcare === "centre" || t.healthcare === "center") return "health_centre";
  if (t.amenity === "doctors" || t.healthcare === "doctor") return "doctors";
  return t.healthcare || t.amenity || "other";
}

function bandOf(score: number): QualityBand {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "needs";
  return "critical";
}

export const BAND_COLOR: Record<QualityBand, string> = {
  excellent: "#16a34a",
  good: "#eab308",
  needs: "#f97316",
  critical: "#dc2626",
};

export const BAND_LABEL: Record<QualityBand, string> = {
  excellent: "Excellent",
  good: "Good",
  needs: "Needs Improvement",
  critical: "Critical",
};

const ADDR_FIELDS = ["addr:street", "addr:housenumber", "addr:city", "addr:state", "addr:postcode", "addr:country"] as const;

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : Math.round((hit / total) * 100);
}

export function scoreFacility(el: OverpassElement): FacilityScore {
  const t = el.tags || {};
  const ft = facilityType(el);
  const coords = elementCoords(el);
  const name = t.name || t["name:en"] || "";
  const unnamed = !name;

  const missing: string[] = [];
  const issues: QualityIssue[] = [];

  const addField = (key: string, label: string, suggestion: string, severity: QualityIssue["severity"] = "warn") => {
    missing.push(key);
    issues.push({ key, label, severity, suggestion, osmTags: [key] });
  };

  // Attribute completeness
  const attrFields = ["name", "operator", "building"];
  if (ft === "hospital" || ft === "clinic" || ft === "health_centre" || ft === "doctors") attrFields.push("healthcare:speciality");
  let attrHit = 0;
  for (const f of attrFields) {
    if (t[f]) attrHit++;
    else {
      const critical = f === "name";
      addField(
        f,
        `Missing ${f.replace("healthcare:speciality", "healthcare speciality")}`,
        f === "name"
          ? "Add a name tag so this facility can be searched and identified."
          : f === "operator"
          ? "Add the operator (e.g. Ministry of Health, private group)."
          : f === "building"
          ? "Tag the building geometry (building=hospital, yes, etc.)."
          : "Add healthcare:speciality (general, maternity, dental...).",
        critical ? "critical" : "warn",
      );
    }
  }
  const attributes = pct(attrHit, attrFields.length);

  // Contact
  const contactFields = ["phone", "email", "website", "opening_hours"];
  let contactHit = 0;
  for (const f of contactFields) {
    if (t[f] || (f === "phone" && t["contact:phone"])) contactHit++;
    else {
      addField(
        f,
        `Missing ${f.replace("_", " ")}`,
        f === "phone"
          ? "Add a phone number so patients can reach the facility."
          : f === "opening_hours"
          ? "Add opening_hours (e.g. 24/7, Mo-Fr 08:00-18:00)."
          : f === "email"
          ? "Add an email contact."
          : "Add a website URL.",
      );
    }
  }
  const contact = pct(contactHit, contactFields.length);

  // Address
  let addrHit = 0;
  for (const f of ADDR_FIELDS) {
    if (t[f]) addrHit++;
    else
      addField(
        f,
        `Missing ${f.replace("addr:", "")}`,
        `Add ${f} to complete the postal address.`,
        f === "addr:street" || f === "addr:city" ? "warn" : "info",
      );
  }
  const address = pct(addrHit, ADDR_FIELDS.length);
  const addressCompleteness = address;

  // Consistency
  let consistency = 100;
  if (t.amenity === "pharmacy" && t.shop && !t.healthcare) {
    consistency -= 30;
    issues.push({
      key: "consistency:shop-only-pharmacy",
      label: "Pharmacy tagged only as shop",
      severity: "warn",
      suggestion: "Add healthcare=pharmacy alongside amenity=pharmacy for consistency.",
      osmTags: ["healthcare=pharmacy"],
    });
  }
  if (t.amenity && t.healthcare) {
    const map: Record<string, string> = { hospital: "hospital", clinic: "clinic", pharmacy: "pharmacy", doctors: "doctor" };
    const expected = map[t.amenity];
    if (expected && t.healthcare !== expected && !(t.amenity === "clinic" && (t.healthcare === "centre" || t.healthcare === "center"))) {
      consistency -= 25;
      issues.push({
        key: "consistency:amenity-healthcare-mismatch",
        label: `amenity=${t.amenity} conflicts with healthcare=${t.healthcare}`,
        severity: "warn",
        suggestion: "Reconcile amenity and healthcare tags so they describe the same facility type.",
      });
    }
  }
  const deprecated = ["health_facility", "health_facility:type"];
  for (const d of deprecated) {
    if (t[d]) {
      consistency -= 10;
      issues.push({
        key: `consistency:deprecated-${d}`,
        label: `Deprecated tag ${d}`,
        severity: "info",
        suggestion: `Replace ${d} with the current healthcare=* scheme.`,
      });
    }
  }
  consistency = Math.max(0, consistency);

  // Missing wheelchair / emergency access markers (info)
  if (!t.wheelchair) {
    issues.push({
      key: "wheelchair",
      label: "Missing wheelchair accessibility",
      severity: "info",
      suggestion: "Add wheelchair=yes/limited/no so patients with mobility needs can plan visits.",
      osmTags: ["wheelchair"],
    });
    missing.push("wheelchair");
  }
  if ((ft === "hospital" || ft === "health_centre") && !t.emergency) {
    issues.push({
      key: "emergency",
      label: "Missing emergency tag",
      severity: "info",
      suggestion: "Add emergency=yes/no to indicate 24/7 emergency capability.",
      osmTags: ["emergency"],
    });
    missing.push("emergency");
  }

  // Geometry
  let geometry = coords ? 100 : 0;
  if (!coords) {
    issues.push({
      key: "geometry:no-coords",
      label: "No usable geometry",
      severity: "critical",
      suggestion: "Add a node or centroid so this facility can be located.",
    });
  }

  const score = Math.round(
    attributes * 0.28 +
      contact * 0.22 +
      address * 0.2 +
      consistency * 0.2 +
      geometry * 0.1,
  );

  return {
    element: el,
    coords,
    facilityType: ft,
    score,
    band: bandOf(score),
    breakdown: { attributes, contact, address, consistency, geometry },
    addressCompleteness,
    missingTags: missing,
    issues,
    name: name || `Unnamed ${ft.replace("_", " ")}`,
    unnamed,
  };
}

export function scoreAll(elements: OverpassElement[]): FacilityScore[] {
  return elements.map(scoreFacility);
}

function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function nameSimilarity(a: string, b: string): number {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sa = new Set(na.split(" "));
  const sb = new Set(nb.split(" "));
  let inter = 0;
  sa.forEach((w) => sb.has(w) && inter++);
  return inter / new Set([...sa, ...sb]).size;
}

/** O(n) duplicate detection via ~200m grid cells. */
export function detectDuplicates(scored: FacilityScore[]): DuplicatePair[] {
  const CELL = 0.002; // ~200m
  const buckets = new Map<string, FacilityScore[]>();
  for (const f of scored) {
    if (!f.coords) continue;
    const [lat, lng] = f.coords;
    const key = `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>();
  for (const [key, list] of buckets) {
    const [gy, gx] = key.split(":").map(Number);
    const neighbours: FacilityScore[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k2 = `${gy + dy}:${gx + dx}`;
        if (buckets.has(k2)) neighbours.push(...buckets.get(k2)!);
      }
    for (const a of list) {
      for (const b of neighbours) {
        if (a === b) continue;
        const idA = `${a.element.type}/${a.element.id}`;
        const idB = `${b.element.type}/${b.element.id}`;
        const pk = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        if (seen.has(pk)) continue;
        const d = haversine(a.coords!, b.coords!) * 1000;
        if (d > 120) continue;
        const sim = nameSimilarity(a.name, b.name);
        let confidence: DuplicatePair["confidence"] = "low";
        let reason = "Very close coordinates";
        if (d < 15 && (sim > 0.6 || (a.unnamed && b.unnamed && a.facilityType === b.facilityType))) {
          confidence = "high";
          reason = "Nearly identical location and similar name/type";
        } else if (d < 50 && sim > 0.5 && a.facilityType === b.facilityType) {
          confidence = "medium";
          reason = "Close proximity with matching type and name overlap";
        } else if (d < 100 && sim > 0.3) {
          confidence = "low";
          reason = "Nearby facilities with partial name overlap";
        } else if (d < 25 && a.facilityType === b.facilityType) {
          confidence = "medium";
          reason = "Overlapping location, same facility type";
        } else {
          continue;
        }
        seen.add(pk);
        pairs.push({ a, b, distanceM: d, nameSimilarity: sim, confidence, reason });
      }
    }
  }
  return pairs.sort((a, b) => a.distanceM - b.distanceM);
}

/** Facilities > thresholdM from any mapped road are flagged. */
export function roadConnectivity(
  scored: FacilityScore[],
  roads: OverpassElement[],
  thresholdM = 150,
): Map<string, number> {
  const nodes: [number, number][] = [];
  for (const r of roads) {
    if (r.geometry) for (const g of r.geometry) nodes.push([g.lat, g.lon]);
  }
  if (!nodes.length) return new Map();
  // Simple bucket index for speed.
  const CELL = 0.01;
  const idx = new Map<string, [number, number][]>();
  for (const n of nodes) {
    const key = `${Math.floor(n[0] / CELL)}:${Math.floor(n[1] / CELL)}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push(n);
  }
  const dist = new Map<string, number>();
  for (const f of scored) {
    if (!f.coords) continue;
    const [lat, lng] = f.coords;
    const gy = Math.floor(lat / CELL);
    const gx = Math.floor(lng / CELL);
    let best = Infinity;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const arr = idx.get(`${gy + dy}:${gx + dx}`);
        if (!arr) continue;
        for (const n of arr) {
          const d = haversine([lat, lng], n) * 1000;
          if (d < best) best = d;
        }
      }
    const id = `${f.element.type}/${f.element.id}`;
    dist.set(id, best);
    if (best > thresholdM) {
      f.issues.push({
        key: "connectivity",
        label: `Not connected to mapped roads (${Math.round(best)}m away)`,
        severity: "warn",
        suggestion: "Trace an access road, service track, or footway from the nearest highway to this facility.",
      });
    }
  }
  return dist;
}

export function aggregate(scored: FacilityScore[], duplicates: DuplicatePair[], disconnected: Map<string, number>): QualityAggregate {
  const total = scored.length;
  let complete = 0,
    unnamed = 0,
    missingPhone = 0,
    missingHours = 0,
    missingAddress = 0,
    sum = 0;
  const byType: Record<string, { total: number; sum: number }> = {};
  const byState: Record<string, { total: number; sum: number }> = {};
  const issueCounts: Record<string, { label: string; count: number }> = {};

  for (const f of scored) {
    sum += f.score;
    if (f.score >= 90) complete++;
    if (f.unnamed) unnamed++;
    const t = f.element.tags || {};
    if (!t.phone && !t["contact:phone"]) missingPhone++;
    if (!t.opening_hours) missingHours++;
    if (f.addressCompleteness < 50) missingAddress++;
    byType[f.facilityType] ||= { total: 0, sum: 0 };
    byType[f.facilityType].total++;
    byType[f.facilityType].sum += f.score;
    const state = t["addr:state"] || "Unknown";
    byState[state] ||= { total: 0, sum: 0 };
    byState[state].total++;
    byState[state].sum += f.score;
    for (const i of f.issues) {
      issueCounts[i.key] ||= { label: i.label, count: 0 };
      issueCounts[i.key].count++;
    }
  }

  let disconnectedCount = 0;
  disconnected.forEach((d) => {
    if (d > 150) disconnectedCount++;
  });

  const overall = total ? Math.round(sum / total) : 0;

  const topIssues = Object.entries(issueCounts)
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mapType = (r: Record<string, { total: number; sum: number }>) => {
    const out: Record<string, { total: number; avgScore: number }> = {};
    for (const [k, v] of Object.entries(r)) out[k] = { total: v.total, avgScore: Math.round(v.sum / v.total) };
    return out;
  };

  return {
    total,
    complete,
    incomplete: total - complete,
    unnamed,
    missingPhone,
    missingHours,
    missingAddress,
    duplicateCandidates: duplicates.length,
    disconnected: disconnectedCount,
    overall,
    band: bandOf(overall),
    byType: mapType(byType),
    byState: mapType(byState),
    topIssues,
  };
}

export function osmUrl(el: OverpassElement): string {
  return `https://www.openstreetmap.org/${el.type}/${el.id}`;
}
export function idEditorUrl(el: OverpassElement): string {
  const c = elementCoords(el);
  const at = c ? `#map=19/${c[0]}/${c[1]}` : "";
  return `https://www.openstreetmap.org/edit?editor=id&${el.type}=${el.id}${at}`;
}
export function josmRemoteUrl(el: OverpassElement): string {
  return `http://127.0.0.1:8111/load_object?objects=${el.type[0]}${el.id}`;
}
