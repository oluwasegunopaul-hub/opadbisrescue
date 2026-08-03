import type { FacilityScore, QualityAggregate, DuplicatePair } from "./quality";
import { osmUrl } from "./quality";

function download(name: string, mime: string, content: string | Blob) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(scored: FacilityScore[]) {
  const cols = ["osm_id", "type", "name", "facility_type", "score", "band", "lat", "lng", "missing_tags", "phone", "opening_hours", "url"];
  const rows = scored.map((f) => {
    const t = f.element.tags || {};
    return [
      f.element.id,
      f.element.type,
      f.name,
      f.facilityType,
      f.score,
      f.band,
      f.coords?.[0] ?? "",
      f.coords?.[1] ?? "",
      f.missingTags.join("|"),
      t.phone || t["contact:phone"] || "",
      t.opening_hours || "",
      osmUrl(f.element),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  download(`osm-quality-${Date.now()}.csv`, "text/csv", [cols.join(","), ...rows].join("\n"));
}

export function exportGeoJson(scored: FacilityScore[]) {
  const fc = {
    type: "FeatureCollection",
    features: scored
      .filter((f) => f.coords)
      .map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.coords![1], f.coords![0]] },
        properties: {
          osm_id: f.element.id,
          osm_type: f.element.type,
          name: f.name,
          facility_type: f.facilityType,
          score: f.score,
          band: f.band,
          missing_tags: f.missingTags,
          address_completeness: f.addressCompleteness,
          issues: f.issues.map((i) => i.label),
          url: osmUrl(f.element),
          ...f.element.tags,
        },
      })),
  };
  download(`osm-quality-${Date.now()}.geojson`, "application/geo+json", JSON.stringify(fc, null, 2));
}

export function exportIssuesJson(scored: FacilityScore[], duplicates: DuplicatePair[], agg: QualityAggregate) {
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: agg,
    duplicates: duplicates.map((d) => ({
      confidence: d.confidence,
      distanceM: Math.round(d.distanceM),
      reason: d.reason,
      a: { id: d.a.element.id, type: d.a.element.type, name: d.a.name, url: osmUrl(d.a.element) },
      b: { id: d.b.element.id, type: d.b.element.type, name: d.b.name, url: osmUrl(d.b.element) },
    })),
    facilities: scored.map((f) => ({
      id: f.element.id,
      type: f.element.type,
      name: f.name,
      facilityType: f.facilityType,
      score: f.score,
      band: f.band,
      missing: f.missingTags,
      issues: f.issues,
      url: osmUrl(f.element),
    })),
  };
  download(`osm-quality-report-${Date.now()}.json`, "application/json", JSON.stringify(payload, null, 2));
}

export function exportHtmlReport(agg: QualityAggregate, scored: FacilityScore[], duplicates: DuplicatePair[]) {
  const rows = scored
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 100)
    .map(
      (f) => `<tr>
    <td>${f.score}</td><td>${f.band}</td><td>${escape(f.name)}</td>
    <td>${f.facilityType}</td><td>${f.missingTags.slice(0, 6).join(", ")}</td>
    <td><a href="${osmUrl(f.element)}" target="_blank" rel="noopener">OSM</a></td>
  </tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OSM Healthcare Quality Report</title>
  <style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a}h1{margin-bottom:4px}h2{margin-top:32px}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
  .kpi{display:inline-block;padding:12px 16px;margin:4px;border:1px solid #e2e8f0;border-radius:8px;min-width:140px}
  .kpi b{display:block;font-size:22px}</style></head><body>
  <h1>OSM Healthcare Quality Report</h1>
  <p>Generated ${new Date().toLocaleString()}</p>
  <div>
    <div class="kpi"><b>${agg.overall}</b>Overall score</div>
    <div class="kpi"><b>${agg.total}</b>Facilities</div>
    <div class="kpi"><b>${agg.complete}</b>Complete</div>
    <div class="kpi"><b>${agg.unnamed}</b>Unnamed</div>
    <div class="kpi"><b>${agg.missingPhone}</b>Missing phone</div>
    <div class="kpi"><b>${agg.missingHours}</b>Missing hours</div>
    <div class="kpi"><b>${agg.duplicateCandidates}</b>Duplicate candidates</div>
    <div class="kpi"><b>${agg.disconnected}</b>Disconnected</div>
  </div>
  <h2>Top issues</h2>
  <ul>${agg.topIssues.map((i) => `<li>${escape(i.label)} — ${i.count}</li>`).join("")}</ul>
  <h2>Lowest-scoring facilities</h2>
  <table><thead><tr><th>Score</th><th>Band</th><th>Name</th><th>Type</th><th>Missing tags</th><th>Link</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <h2>Duplicate candidates (${duplicates.length})</h2>
  <table><thead><tr><th>Confidence</th><th>A</th><th>B</th><th>Distance</th><th>Reason</th></tr></thead>
  <tbody>${duplicates
    .slice(0, 50)
    .map(
      (d) => `<tr><td>${d.confidence}</td><td><a href="${osmUrl(d.a.element)}" target="_blank">${escape(d.a.name)}</a></td>
      <td><a href="${osmUrl(d.b.element)}" target="_blank">${escape(d.b.name)}</a></td>
      <td>${Math.round(d.distanceM)}m</td><td>${escape(d.reason)}</td></tr>`,
    )
    .join("")}</tbody></table>
  <p style="margin-top:32px;color:#64748b;font-size:12px">Data © OpenStreetMap contributors, ODbL 1.0.</p>
  </body></html>`;
  download(`osm-quality-report-${Date.now()}.html`, "text/html", html);
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
