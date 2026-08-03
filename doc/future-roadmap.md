# Future Roadmap

[← Documentation index](../README.md#documentation)

Directional, not committed. Ordered roughly by value-to-effort.

## Near term

| Item | Value |
| --- | --- |
| Automated test suite for scoring and exports | Protects the numbers researchers cite |
| `opening_hours` syntax validation | Catches a common malformed-tag class |
| Phone-number normalisation (E.164) | Makes contact data machine-usable |
| Configurable connectivity threshold | Reduces false positives in rural areas |
| Saved study-area links | Shareable, citable views |

## Medium term

| Item | Value |
| --- | --- |
| Population-weighted accessibility | Moves from facility counts to people-per-facility coverage |
| Isochrone catchments | Travel-time coverage rather than straight-line radius |
| Historical quality snapshots | Shows whether mapping efforts are working |
| Offline / PWA mode | Field use without connectivity |
| Multi-state comparison view | Supports national analysis |

## Long term

| Item | Value |
| --- | --- |
| Self-hosted Overpass and OSRM | Removes public-mirror dependency and rate limits |
| Optional accounts with saved worklists | Sustained contributor engagement |
| Integration with official facility registries | Cross-validation of OSM against authoritative lists |
| Mapathon coordination tooling | Turns worklists into managed tasks |
| API for third-party consumers | Lets other tools build on the analysis |

## Explicit non-goals

- Becoming a dispatch or clinical system — this is decision support only.
- Storing patient or personally identifying data.
- Bulk-importing data into OSM without an approved community import plan.
- Gating the core public dashboards behind authentication.
