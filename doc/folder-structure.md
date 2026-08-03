# Folder Structure

[← Documentation index](../README.md#documentation)

## Table of Contents

- [Complete tree](#complete-tree)
- [Root files](#root-files)
- [`docs/`](#docs)
- [`public/`](#public)
- [`src/routes/`](#srcroutes)
- [`src/components/`](#srccomponents)
- [`src/hooks/`](#srchooks)
- [`src/lib/`](#srclib)
- [Naming conventions](#naming-conventions)
- [Where to put new code](#where-to-put-new-code)

## Complete tree

```text
.
├── AGENTS.md                          # Agent/automation notes for this repository
├── CHANGELOG.md                       # Keep-a-Changelog release history
├── CODE_OF_CONDUCT.md                 # Contributor Covenant 2.1 + data ethics addendum
├── CONTRIBUTING.md                    # Contribution workflow and standards
├── LICENSE                            # MIT licence + ODbL data notice
├── README.md                          # Project entry point
├── .env.example                       # Documented, optional environment template
├── bun.lock                           # Bun lockfile (committed)
├── bunfig.toml                        # Bun configuration
├── components.json                    # shadcn/ui generator configuration
├── eslint.config.js                   # Flat ESLint config
├── package.json                       # Scripts and dependencies
├── tsconfig.json                      # Strict TS config, "@/*" -> "src/*"
├── vite.config.ts                     # Vite + TanStack Start build configuration
│
├── docs/                              # Full documentation set (this folder)
│
├── public/                            # Served verbatim at the site root
│   ├── favicon.ico
│   └── robots.txt
│
└── src/
    ├── router.tsx                     # createRouter + QueryClient factory
    ├── routeTree.gen.ts               # GENERATED route tree — never edit
    ├── server.ts                      # Server entry point
    ├── start.ts                       # TanStack Start runtime configuration
    ├── styles.css                     # Design system: oklch tokens + Tailwind v4 theme
    │
    ├── routes/                        # File-based routes
    │   ├── README.md                  # Routing conventions
    │   ├── __root.tsx                 # HTML shell, providers, 404 and error boundaries
    │   ├── index.tsx                  # "/"        Accessibility dashboard
    │   └── quality.tsx                # "/quality" OSM data quality dashboard
    │
    ├── components/
    │   ├── gis/                       # Accessibility & emergency response UI
    │   │   ├── OyoMap.tsx             # Main Leaflet map, layers, clustering, interactions
    │   │   ├── LeftNav.tsx            # Module navigation and layer controls
    │   │   ├── RightPanel.tsx         # Feature inspection and analysis panel
    │   │   ├── NearestPanel.tsx       # Nearest-facility results and route launcher
    │   │   ├── NavigationGuide.tsx    # Turn-by-turn emergency navigation UI
    │   │   ├── KpiBar.tsx             # Headline indicators for the study area
    │   │   ├── BottomPanel.tsx        # Analytics and tabular output
    │   │   └── GettingStartedGuide.tsx# Help menu, quick-start checklist, first-visit logic
    │   │
    │   ├── quality/                   # Data quality UI
    │   │   ├── QualityMap.tsx         # Band-coloured facility map
    │   │   ├── NearbyQualityPanel.tsx # Quality context around a selected point
    │   │   └── QualityTour.tsx        # Quality dashboard onboarding wrapper
    │   │
    │   ├── shared/                    # Used by both modules
    │   │   ├── AdminAreaSelector.tsx  # State/LGA selection + boundary fetch
    │   │   ├── BasemapGallery.tsx     # Basemap switcher with swatches
    │   │   └── StudyAreaLayer.tsx     # Renders the study-area polygon and mask
    │   │
    │   ├── tour/                      # Guided onboarding
    │   │   ├── TourEngine.tsx         # Generic step engine with spotlight positioning
    │   │   ├── accessibility-tour.ts  # Step script for "/"
    │   │   └── quality-tour.ts        # Step script for "/quality"
    │   │
    │   └── ui/                        # 46 shadcn/ui primitives (button, card, dialog, …)
    │
    ├── hooks/
    │   ├── useOverpass.ts             # Scoped OSM data access: bundle, per-layer, healthcare, roads
    │   ├── use-hydrated.ts            # SSR-safe hydration gate
    │   └── use-mobile.tsx             # Responsive breakpoint hook
    │
    └── lib/
        ├── oyo.ts                     # BBox math, layer definitions, Overpass QL builders, haversine
        ├── nigeria-admin.ts           # 36 states + FCT and 770+ LGAs with centroids
        ├── study-area.ts              # StudyArea construction, bbox, point-in-polygon
        ├── admin-boundary.functions.ts# Server function: getAdminBoundary
        ├── admin-boundary.server.ts   # Nominatim + Overpass boundary resolution, ring stitching
        ├── overpass.functions.ts      # Server function: runOverpass with mirror failover
        ├── nearest.ts                 # Nearest-facility search + OSRM routing + step humanisation
        ├── quality.ts                 # Scoring, duplicates, connectivity, aggregation, OSM deep links
        ├── quality-export.ts          # CSV / GeoJSON / issues JSON / HTML report writers
        ├── basemaps.ts                # Tile provider definitions and attribution
        ├── store.ts                   # Zustand UI/session store
        ├── utils.ts                   # cn() class merge helper
        ├── error-capture.ts           # Global error capture wiring
        ├── error-page.ts              # Error page helpers
        └── lovable-error-reporting.ts # Error reporting bridge
```

## Root files

| File | Purpose |
| --- | --- |
| `README.md` | Entry point: description, features, stack, quick start, docs index |
| `LICENSE` | MIT for code, with an explicit ODbL notice for OSM data |
| `CHANGELOG.md` | Release history; update on every user-visible change |
| `CONTRIBUTING.md` | Branching, commits, PR checklist, coding standards |
| `CODE_OF_CONDUCT.md` | Community standards and data ethics |
| `.env.example` | Canonical, fully documented environment template |
| `package.json` | `dev`, `build`, `build:dev`, `preview`, `lint`, `format` |
| `vite.config.ts` | Build pipeline; never add `ssr.external` for the worker environment |
| `tsconfig.json` | Strict mode and the `@/*` path alias |
| `eslint.config.js` | TypeScript + React Hooks + Prettier rules |
| `components.json` | shadcn/ui component generation targets |

## `docs/`

Flat by design — one topic per file, cross-linked. Adding a document means adding a row to the README documentation table and linking it from any related document.

## `public/`

Served verbatim from the site root. `favicon.ico` must remain a real binary file. `robots.txt` controls crawler access. Prefer `src/assets/` with ES imports for anything a component references, so it is hashed and cached properly.

## `src/routes/`

File-based routing; the file path is the URL.

| File | URL | Responsibility |
| --- | --- | --- |
| `__root.tsx` | — | `<html>` shell, `HeadContent`, `Scripts`, `QueryClientProvider`, 404 and error boundaries |
| `index.tsx` | `/` | Accessibility dashboard shell: header, panels, lazy map, guided tour |
| `quality.tsx` | `/quality` | Quality dashboard: scoring pipeline, filters, charts, exports |

Rules:
- `routeTree.gen.ts` is generated — never edit it.
- Every route defines its own `head()` with a unique title and description.
- Every parent route component must render `<Outlet />`.
- Create the route file before linking to it.

## `src/components/`

| Directory | Rule |
| --- | --- |
| `gis/` | Accessibility module only; may read the store and OSM hooks |
| `quality/` | Quality module only |
| `shared/` | Used by both modules; no module-specific assumptions |
| `tour/` | Onboarding; tour scripts are data, the engine is generic |
| `ui/` | shadcn/ui primitives; keep them unmodified where possible so upstream updates remain mergeable — express project styling through `src/styles.css` tokens and component variants |

Components that touch Leaflet (`OyoMap.tsx`, `QualityMap.tsx`) are **lazily imported** by their route and rendered only after `useHydrated()` returns true.

## `src/hooks/`

| Hook | Purpose |
| --- | --- |
| `useOverpass.ts` | The data access layer: `useLayerQuery`, `useHealthcare`, `useRoads`, study-area bundling, clipping, zoom/area gating |
| `use-hydrated.ts` | Returns `true` only after client hydration; gates all browser-only rendering |
| `use-mobile.tsx` | Breakpoint detection for responsive panels |

## `src/lib/`

Split into four categories:

| Category | Files | Rule |
| --- | --- | --- |
| Pure domain logic | `quality.ts`, `nearest.ts`, `oyo.ts`, `study-area.ts`, `quality-export.ts` | No React imports; unit-testable in isolation |
| Server functions | `*.functions.ts` | Thin wrappers: imports, types and the exported declaration only |
| Server-only implementation | `*.server.ts` | Excluded from the client bundle by filename; never import from a component |
| Static data & state | `nigeria-admin.ts`, `basemaps.ts`, `store.ts`, `utils.ts` | Serialisable data and cross-component state |

> The thin-wrapper rule for `*.functions.ts` is not stylistic. The build splits these modules and deletes runtime siblings — putting a helper beside a `createServerFn` declaration produces a `ReferenceError` at runtime even though the typecheck passes.

## Naming conventions

| Artefact | Convention | Example |
| --- | --- | --- |
| React component file | PascalCase `.tsx` | `NearestPanel.tsx` |
| Hook file | camelCase or `use-` kebab | `useOverpass.ts`, `use-hydrated.ts` |
| Domain module | kebab-case `.ts` | `study-area.ts` |
| Server function module | `<feature>.functions.ts` | `overpass.functions.ts` |
| Server-only module | `<feature>.server.ts` | `admin-boundary.server.ts` |
| Route file | lowercase, path-mirroring | `quality.tsx` |
| Type | PascalCase | `FacilityScore` |
| Constant | SCREAMING_SNAKE_CASE | `SEARCH_RADII_M` |

## Where to put new code

| You are adding… | Put it in… |
| --- | --- |
| A new page | `src/routes/<name>.tsx` with its own `head()` |
| A map layer | Layer definition in `src/lib/oyo.ts`, toggle in `src/lib/store.ts`, rendering in `OyoMap.tsx` |
| A quality check | A rule in `src/lib/quality.ts` plus a row in [data-quality-module.md](./data-quality-module.md) |
| An export format | `src/lib/quality-export.ts` |
| A basemap | `src/lib/basemaps.ts` and the `BasemapKey` union in `src/lib/store.ts` |
| An external API call | `src/lib/<feature>.server.ts` + a thin `<feature>.functions.ts` |
| Shared UI | `src/components/shared/` |
| A design token | `:root`, `.dark` and `@theme inline` in `src/styles.css` |
