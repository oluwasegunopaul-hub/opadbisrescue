## OSM Healthcare Data Quality Intelligence — Build Plan

Add a dedicated **OSM Data Quality** section alongside the existing accessibility dashboard. It reuses the current Overpass pipeline (`useHealthcare`, `runOverpass`) and Leaflet map, but layers quality analysis, AI guidance, and export tools on top. No writes to OSM — the app only surfaces issues and links to editors.

### 1. Navigation & Routes
- New route `src/routes/quality.tsx` (`/quality`) with own `head()` metadata.
- Add a top-level nav switcher in `__root.tsx` / header: **Accessibility** ↔ **OSM Data Quality**.
- Preserve current `/` dashboard unchanged.

### 2. Quality Engine (`src/lib/quality.ts`)
Pure functions on `OverpassElement[]`:
- `scoreFacility(el)` → `{ score, breakdown, missingTags[], issues[] }` weighted across:
  - Attribute completeness (name, operator, healthcare speciality, building)
  - Contact (phone, email, website)
  - Address (addr:street, housenumber, city, postcode, state, country)
  - Tag consistency (amenity vs healthcare mismatch, deprecated tags, shop-only pharmacy)
  - Geometry (has coords, node vs way sanity)
- `detectDuplicates(elements)` → grid-hash within ~30m + name similarity (Jaccard/Levenshtein) → confidence High/Medium/Low.
- `detectUnnamed(elements)` → grouped by facility type.
- `roadConnectivity(facilities, roads)` → nearest-road distance using existing roads layer; flag >150m as disconnected, service-only, etc.
- `aggregate(elements)` → totals for KPIs and per-state / per-LGA rollups (state derived from `addr:state` when present, else spatial bucket).
- Band: Excellent / Good / Needs Improvement / Critical.

### 3. Quality Dashboard Page
Layout (responsive, dark/light already supported via tokens):

```text
┌─────────── Quality KPI Bar ────────────┐
│ Total • Complete • Incomplete • Unnamed│
│ Missing phone • Missing hours • Dupes  │
│ Disconnected • Incomplete addr • Score │
└────────────────────────────────────────┘
┌── Left: Filters ──┬── Quality Map ──┬── Right: AI Assistant ──┐
│ State / LGA       │ Colour-coded    │ Insights list           │
│ Facility type     │ markers +       │ "17 clinics missing..." │
│ Issue type        │ heatmap toggle  │ Contribution tips       │
│ Score band        │ Popup = report  │                         │
└───────────────────┴─────────────────┴─────────────────────────┘
┌─────────── Bottom: Tabs ───────────────────────────────────────┐
│ Issues • Duplicates • Unnamed • Connectivity • Timeline • Chart│
└────────────────────────────────────────────────────────────────┘
```

Components under `src/components/quality/`:
- `QualityMap.tsx` — Leaflet map, colour-coded markers (green/yellow/orange/red) + optional heatmap (leaflet.heat, already usable) via score density.
- `QualityKpiBar.tsx`
- `QualityFilters.tsx`
- `IssueExplorer.tsx` — virtualised table of issues with fix suggestions.
- `DuplicatePanel.tsx` — side-by-side record comparison.
- `UnnamedList.tsx` — click to zoom.
- `ConnectivityPanel.tsx`
- `AiAssistantPanel.tsx` — calls Lovable AI (server fn) with the aggregated quality summary to produce natural-language insights + contribution guidance.
- `QualityTimeline.tsx` — persist daily snapshots of aggregate metrics in `localStorage` (keyed per viewport/state) to show trend without a backend.
- `QualityCharts.tsx` — Recharts bars for missing phone/hours/address, top-20 areas needing mapping.
- `ContributionActions.tsx` — per-feature buttons: View on OSM, Open in iD, Open in JOSM remote control (`http://127.0.0.1:8111/load_object`), Copy feature ID.
- `ExportMenu.tsx` — CSV, GeoJSON, XLSX (SheetJS), PDF (jspdf + autotable).

### 4. AI Insights (Lovable Cloud + AI Gateway)
- Enable Lovable Cloud (needed for `LOVABLE_API_KEY`) — no DB tables required; timeline uses localStorage.
- New server fn `src/lib/quality-ai.functions.ts` using `google/gemini-2.5-flash` via `createLovableAiGatewayProvider`. Input: aggregated quality JSON (counts, top offending areas, sample issues). Output: bulleted insights + contribution priorities.
- Client renders streamed/structured text in `AiAssistantPanel`.

### 5. Filters & Exports
- Zustand slice `qualitySlice` in `src/lib/store.ts`: filters, active issue, timeline snapshots.
- Export util in `src/lib/quality-export.ts` — CSV, GeoJSON, XLSX, PDF report (summary + top issues).

### 6. Header & Branding
- Rename header subtitle to "Healthcare accessibility & data quality intelligence".
- Add tab-style nav in header linking `/` and `/quality`.

### Technical notes
- Reuses existing Overpass server fn; no new endpoints needed for data fetch.
- Duplicate detection is O(n) via lat/lng grid buckets to stay responsive.
- Road connectivity uses roads layer already fetched when zoom permits; otherwise disabled with tooltip "Zoom in to enable connectivity analysis" — matches current layer-gate UX.
- All colours use existing semantic tokens (`--destructive`, `--warning` added if missing, plus success token) — no hardcoded hex.
- New packages: `xlsx`, `jspdf`, `jspdf-autotable`, `leaflet.heat` (if not present), `recharts` (likely already).
