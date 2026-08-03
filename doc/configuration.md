# Configuration

[← Documentation index](../README.md#documentation)

## Table of Contents

- [Configuration philosophy](#configuration-philosophy)
- [Environment variables](#environment-variables)
- [Variable reference](#variable-reference)
- [In-code configuration constants](#in-code-configuration-constants)
- [Design system configuration](#design-system-configuration)
- [Build configuration](#build-configuration)
- [Environment-specific recommendations](#environment-specific-recommendations)

## Configuration philosophy

The application is designed to run correctly with **zero configuration**. Environment variables exist only to override defaults — typically to point at self-hosted OSM infrastructure in a production deployment.

Two variable classes:

| Prefix | Visibility | Access | Use for |
| --- | --- | --- | --- |
| `VITE_*` | Inlined into the browser bundle — **public** | `import.meta.env.VITE_X` | Client-side endpoints and defaults |
| everything else | Server-only | `process.env['X']` **inside a handler** | Upstream endpoints, timeouts, User-Agent |

> Reading `process.env.X` at module scope returns `undefined` in the edge runtime. Always read inside `.handler()`.

## Environment variables

```sh
cp .env.example .env
```

`.env` is git-ignored. `.env.example` is the canonical, documented template — update it in the same commit whenever you add a variable.

## Variable reference

### Server / runtime

| Variable | Required | Default | Example | Purpose |
| --- | --- | --- | --- | --- |
| `PORT` | No | `8080` | `3000` | Dev server port |
| `NODE_ENV` | No | `development` | `production` | Build/runtime mode |

### OpenStreetMap data sources (server-side)

| Variable | Required | Default | Example | Purpose |
| --- | --- | --- | --- | --- |
| `OVERPASS_ENDPOINTS` | No | four public mirrors (see below) | `https://overpass.internal/api/interpreter` | Comma-separated interpreter URLs tried in order |
| `OVERPASS_TIMEOUT_MS` | No | `60000` | `90000` | Abort timeout per Overpass request |
| `OSM_USER_AGENT` | No | `opadbisrescue GIS Dashboard/1.0 (OpenStreetMap data viewer)` | `MyOrg opadbisrescue/1.2 (gis@myorg.example)` | Identifier sent to OSM services |
| `NOMINATIM_BASE_URL` | No | `https://nominatim.openstreetmap.org` | `https://nominatim.internal` | Boundary geocoding host |

Built-in Overpass mirror order (`src/lib/overpass.functions.ts`):

1. `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
2. `https://overpass-api.de/api/interpreter`
3. `https://overpass.kumi.systems/api/interpreter`
4. `https://overpass.private.coffee/api/interpreter`

The boundary resolver (`src/lib/admin-boundary.server.ts`) uses its own ordering, leading with `overpass-api.de`.

> **Operational note.** The OSM Foundation's usage policy expects a descriptive, contactable `User-Agent` and discourages heavy automated load on shared instances. Any deployment serving real users should set `OSM_USER_AGENT` and self-host Overpass.

### Routing (client-side)

| Variable | Required | Default | Example | Purpose |
| --- | --- | --- | --- | --- |
| `VITE_OSRM_BASE_URL` | No | `https://router.project-osrm.org` | `https://osrm.myorg.example` | OSRM host for emergency navigation |

The public OSRM demo server is explicitly not for production use. Self-host before launch.

### Map defaults (client-side)

| Variable | Required | Default | Example | Purpose |
| --- | --- | --- | --- | --- |
| `VITE_DEFAULT_BASEMAP` | No | `carto-light` | `esri-imagery` | Basemap on first load. One of `osm`, `hot`, `esri-imagery`, `carto-light`, `carto-dark` |
| `VITE_DEFAULT_CENTER` | No | `9.08,8.68` | `7.38,3.94` | Initial map centre `lat,lng` |

### Observability (client-side, optional)

| Variable | Required | Default | Example | Purpose |
| --- | --- | --- | --- | --- |
| `VITE_ANALYTICS_ENDPOINT` | No | disabled | `https://plausible.example/api/event` | Anonymous usage analytics |
| `VITE_ERROR_REPORTING_DSN` | No | disabled | `https://abc@sentry.example/1` | Error reporting sink |

## In-code configuration constants

Several tuning parameters intentionally live in source rather than the environment, because changing them changes analytical meaning and must be reviewed and versioned.

### Data access — `src/lib/oyo.ts`

| Constant | Purpose |
| --- | --- |
| `OYO_CENTER` | Default map centre (`[9.08, 8.68]`, national view) |
| `LAYER_MIN_ZOOM` | Minimum zoom before a layer may query, per layer |
| `LAYER_MAX_AREA` | Maximum bbox area in square degrees, per layer |
| `quantizeBbox()` | Cache-key rounding precision (default 2 decimals; 3 for study areas) |

### Query caching — `src/hooks/useOverpass.ts`

| Constant | Value | Purpose |
| --- | --- | --- |
| `STALE` | 30 min | How long cached Overpass data is considered fresh |
| `GC` | 60 min | Cache eviction window |
| `retry` | 3 | Retry attempts per query |
| `retryDelay` | `min(1000·2^n, 20000)` | Exponential backoff cap |

### Nearest-facility search — `src/lib/nearest.ts`

| Constant | Value | Purpose |
| --- | --- | --- |
| `SEARCH_RADII_M` | `[5000, 10000, 25000, 50000]` | Expanding search radii in metres |

### Quality scoring — `src/lib/quality.ts`

| Constant | Value | Purpose |
| --- | --- | --- |
| Score weights | attributes 0.28, contact 0.22, address 0.20, consistency 0.20, geometry 0.10 | Composite score weighting |
| Band thresholds | ≥90 excellent, ≥75 good, ≥50 needs work, else critical | Band assignment |
| Duplicate cell size | `0.002°` (~200 m) | Spatial bucket size |
| Duplicate max distance | `120 m` | Candidate pair cutoff |
| Connectivity threshold | `150 m` | Distance from a mapped road before flagging |

Changing any of these alters published metrics. Record the change in `CHANGELOG.md` and in [data-quality-module.md](./data-quality-module.md).

### Basemaps — `src/lib/basemaps.ts`

Add a provider by appending a `BasemapDef` (key, label, blurb, tile URL template, attribution, `maxZoom`, swatch gradient) and extending the `BasemapKey` union in `src/lib/store.ts`. Attribution is mandatory.

### Administrative data — `src/lib/nigeria-admin.ts`

`NIGERIA_ADMIN` maps each state to `[lgaName, lat, lng]` rows. Boundary polygons are fetched live; these coordinates are only used for initial centring and selection.

## Design system configuration

All colour, radius and typography tokens live in `src/styles.css` as `oklch` custom properties inside `:root` / `.dark` and are mapped to Tailwind utilities in `@theme inline`.

Rules:
- Never hardcode colour utilities in components; add or reuse a token.
- Add a new token in three places: `:root`, `.dark`, and `@theme inline`.
- Keep `@import` rules at the top of the file; load web fonts via a `<link>` in `src/routes/__root.tsx`, never via a remote CSS `@import`.

## Build configuration

| File | Purpose |
| --- | --- |
| `vite.config.ts` | Vite plugins, TanStack Start integration, path aliases |
| `tsconfig.json` | Strict TypeScript, `@/*` → `src/*` alias |
| `eslint.config.js` | Flat ESLint config with TypeScript, React Hooks and Prettier |
| `components.json` | shadcn/ui generator settings |
| `bunfig.toml` | Bun install/runtime settings |

Never set `ssr.external` or `resolve.external` for the worker SSR environment — the worker has no runtime module resolution and the build will fail.

## Environment-specific recommendations

| Setting | Development | Staging | Production |
| --- | --- | --- | --- |
| Overpass | Public mirrors | Self-hosted or dedicated mirror | Self-hosted, monitored |
| OSRM | Public demo | Self-hosted | Self-hosted, monitored |
| Nominatim | Public | Public or self-hosted | Self-hosted for heavy use |
| `OSM_USER_AGENT` | Default | Org-identifying | Org-identifying with contact address |
| Error reporting | Off | On | On |
| Analytics | Off | Off | Optional, anonymous only |
| Cache stale time | 30 min | 30 min | 30–60 min |
