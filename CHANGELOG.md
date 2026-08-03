# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete documentation suite under `docs/`, plus `README.md`, `LICENSE`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md` and `.env.example`.

## [1.0.0] — 2026-08-01

### Added

**Healthcare Accessibility & Emergency Response**
- Interactive Leaflet map with marker clustering and live OpenStreetMap data.
- National coverage: 36 states + FCT and 770+ LGAs (`src/lib/nigeria-admin.ts`).
- Administrative boundary retrieval via Nominatim with Overpass relation fallback.
- Study-area clipping of every dataset and analytic to the selected boundary.
- Locate Me geolocation with accuracy circle.
- Expanding-radius nearest-facility search (5 / 10 / 25 / 50 km) for hospital,
  clinic, pharmacy and ambulance station.
- OSRM emergency navigation with driving / walking / cycling profiles,
  alternatives and turn-by-turn instruction synthesis.
- Ten toggleable thematic layers with per-layer zoom and area guards.
- Five basemaps including Esri World Imagery satellite.
- KPI bar, bottom analytics panel and right-hand inspection panel.
- First-visit guided tour, quick-start checklist and navigation guide.

**OSM Data Quality**
- Weighted facility quality score with four quality bands.
- Missing-tag detection across attribute, contact, address, accessibility and
  emergency tag groups with per-issue remediation guidance.
- Spatial-grid duplicate detection with distance and name-similarity confidence.
- Road-connectivity analysis flagging facilities beyond 150 m from a mapped road.
- Aggregate scoring by facility type and state, plus top-issue ranking.
- Recharts visualisations of score distribution and issue frequency.
- CSV, GeoJSON, issues JSON and standalone HTML report exports.
- Deep links to openstreetmap.org, the iD editor and JOSM remote control.
- Dedicated quality guided tour and nearby-quality panel.

**Platform**
- TanStack Start v1 with file-based routing and typed server functions.
- Multi-endpoint Overpass failover with HTML-response detection.
- TanStack Query caching (30 min stale, 60 min GC) with exponential retry.
- Zustand UI store; SSR-safe hydration gating for all map code.
