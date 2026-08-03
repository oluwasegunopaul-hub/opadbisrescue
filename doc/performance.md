# Performance

[← Documentation index](../README.md#documentation)

## Current characteristics

| Stage | Cost driver |
| --- | --- |
| Boundary resolution | One Nominatim call, with an Overpass relation fallback |
| Data fetch | One bundled Overpass query per study area for all layers |
| Quality analysis | Linear scoring, grid-accelerated duplicate and connectivity passes |
| Rendering | Marker count and cluster recomputation |

## Techniques in use

- **Bundled queries** — all layers are fetched in a single Overpass request rather than one per layer, cutting round trips and upstream load.
- **Client caching** — results are cached for roughly 30 minutes keyed by study area, so panning and re-selection are free.
- **Spatial grids** — duplicate detection (~200 m cells) and connectivity (~0.01° cells) avoid O(n²) comparisons.
- **Memoisation** — analysis is derived with `useMemo` and recomputed only when inputs change.
- **Clustering** — markers cluster to keep the DOM small at low zoom.

## Guidance

| Situation | Recommendation |
| --- | --- |
| Whole-state query | Prefer per-LGA analysis; state-wide dense queries risk timeouts |
| Many layers active | Disable layers you are not reading |
| Repeated iteration in development | Keep the cache enabled; do not hammer public mirrors |
| Production scale usage | Self-host Overpass and OSRM ([osm-integration.md](./osm-integration.md)) |

## Budgets to protect

- Keep a single Overpass request per study-area change.
- Keep analysis passes linear or grid-accelerated; reject O(n²) additions in review.
- Keep the initial client bundle lean — Leaflet and chart code load only where needed.
- Avoid unbounded arrays in component state; derive instead.
