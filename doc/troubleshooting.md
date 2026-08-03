# Troubleshooting

[← Documentation index](../README.md#documentation)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Blank map area | Leaflet CSS missing, or container has no height | Confirm the Leaflet stylesheet loads and the map container has an explicit height |
| `window is not defined` on refresh | Browser-only module imported at SSR module scope | Load Leaflet-dependent components with a dynamic import behind `ClientOnly` |
| "Map container is already initialized" | Component remounted without disposing the map | Ensure the map instance is removed in the effect cleanup |
| No facilities returned | Study area genuinely sparse, or query timed out | Widen the area, retry, check the Overpass response in the network panel |
| Overpass `429` / `504` | Rate limited or mirror overloaded | Wait, then retry; failover tries the next mirror automatically; self-host for heavy use |
| Boundary not found | Nominatim has no match for the name | Stage-2 Overpass relation fallback should engage; otherwise select a different admin level |
| Routing fails | OSRM demo server busy, or no road path exists | Retry; verify the facility is connected to the road network in the quality dashboard |
| Slow interaction on large areas | Too many features rendered at once | Reduce the study area, disable unused layers, zoom in |
| Stale data after editing OSM | 30-minute client cache plus Overpass mirror lag | Wait and refresh; mirror propagation can take minutes |
| JOSM link does nothing | Remote control disabled | Enable JOSM remote control (port 8111) |
| Build fails with a `*.server` import trace | Server-only code leaked into the client graph | Break the import chain at the leaf, not just the route |

Debugging order: browser console → network panel status codes → the specific server function → the upstream service directly with `curl`.
