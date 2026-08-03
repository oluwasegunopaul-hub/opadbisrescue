# Frontend Architecture

[← Documentation index](../README.md#documentation)

## Table of Contents

- [Overview](#overview)
- [Rendering model](#rendering-model)
- [Routing](#routing)
- [Component inventory](#component-inventory)
- [State management](#state-management)
- [Data access layer](#data-access-layer)
- [Map rendering](#map-rendering)
- [Design system](#design-system)
- [Charts](#charts)
- [Onboarding and guided tours](#onboarding-and-guided-tours)
- [Accessibility](#accessibility)
- [Responsive behaviour](#responsive-behaviour)
- [Error handling](#error-handling)
- [Extending the frontend](#extending-the-frontend)

## Overview

| Aspect | Choice |
| --- | --- |
| Framework | React 19 with TanStack Start (SSR) |
| Language | TypeScript 5.8, strict |
| Routing | TanStack Router, file-based |
| Styling | Tailwind CSS v4 with oklch design tokens |
| Components | shadcn/ui over Radix primitives, lucide-react icons |
| UI state | Zustand |
| Server state | TanStack Query |
| Mapping | Leaflet 1.9 + react-leaflet 5 + leaflet.markercluster |
| Charts | Recharts |
| Notifications | sonner |

## Rendering model

1. The worker renders the route shell server-side for a fast, indexable first paint.
2. `useHydrated()` returns `false` during SSR and the first client render, so the map area shows "Initializing map…".
3. After hydration the map component is dynamically imported via `React.lazy` inside `<Suspense>`.
4. Only then does data fetching begin — and only once a study area is selected.

```tsx
const OyoMap = lazy(() => import("@/components/gis/OyoMap"));

{hydrated ? (
  <Suspense fallback={<div>Loading map…</div>}>
    <OyoMap />
  </Suspense>
) : (
  <div>Initializing map…</div>
)}
```

This ordering is mandatory: Leaflet touches `window` at module scope, so a static import from an SSR route breaks the server render. `<ClientOnly>`-style gating alone is insufficient because it gates *rendering*, not *imports*.

## Routing

| Route | File | Head metadata |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | "opadbisrescue — Healthcare Accessibility GIS" |
| `/quality` | `src/routes/quality.tsx` | "OSM Data Quality — opadbisrescue" |
| shell | `src/routes/__root.tsx` | charset, viewport, og/twitter defaults, stylesheet, favicon |

Each route defines a unique `title`, `description`, `og:title` and `og:description`. `__root.tsx` also supplies the 404 (`notFoundComponent`) and error (`errorComponent`) boundaries and wraps the tree in `QueryClientProvider`.

Navigation between the two dashboards uses `<Link to="/quality">` so client-side transitions preserve the Query cache — switching modules does not re-fetch OSM data.

## Component inventory

### Accessibility module (`src/components/gis/`)

| Component | Lines | Responsibility |
| --- | --- | --- |
| `OyoMap.tsx` | ~680 | Leaflet container, tile layer, ten thematic layers, marker clustering, popups, click/emergency-point handling, viewport reporting into the store |
| `NavigationGuide.tsx` | ~647 | Turn-by-turn emergency navigation: mode selection, step list, distance/duration, route lifecycle |
| `GettingStartedGuide.tsx` | ~732 | Help menu, quick-start checklist, first-visit detection and persistence |
| `NearestPanel.tsx` | ~354 | Nearest hospital/clinic/pharmacy/ambulance results, radius feedback, route launch |
| `RightPanel.tsx` | ~332 | Selected-feature inspection, tag display, contextual actions |
| `LeftNav.tsx` | ~91 | Module navigation modes and layer toggles |
| `BottomPanel.tsx` | ~69 | Tabular analytics for the study area |
| `KpiBar.tsx` | ~66 | Headline indicators above the map |

### Quality module (`src/components/quality/`)

| Component | Lines | Responsibility |
| --- | --- | --- |
| `QualityMap.tsx` | ~209 | Facility map coloured by quality band, focus-on-facility behaviour |
| `NearbyQualityPanel.tsx` | ~170 | Quality context for facilities near a chosen point |
| `QualityTour.tsx` | ~44 | Wraps the tour engine with the quality step script |

The `/quality` route itself (~954 lines) owns the analysis pipeline, filters (type, band, issue, free-text), the facility table, the Recharts panels and the export menu.

### Shared (`src/components/shared/`)

| Component | Responsibility |
| --- | --- |
| `AdminAreaSelector.tsx` | State/LGA comboboxes, triggers `getAdminBoundary`, writes the `StudyArea` into the store |
| `BasemapGallery.tsx` | Visual basemap switcher driven by `BASEMAP_LIST` |
| `StudyAreaLayer.tsx` | Renders the boundary polygon and out-of-area mask |

### Tour (`src/components/tour/`)

`TourEngine.tsx` is a generic, data-driven step engine (spotlight positioning, keyboard navigation, progress). Tours are plain arrays in `accessibility-tour.ts` and `quality-tour.ts`, anchored to `data-tour="..."` attributes in the UI.

### Primitives (`src/components/ui/`)

46 shadcn/ui components. Treat them as vendored: style through tokens and variants rather than editing the primitives, so upstream updates stay mergeable.

## State management

### Zustand — `src/lib/store.ts`

A single flat store. Selected slices only, to avoid re-render cascades:

```ts
const nav = useStore((s) => s.nav);           // good
const store = useStore();                      // avoid
```

| Slice | Fields |
| --- | --- |
| Navigation | `nav`, `setNav` |
| Presentation | `basemap`, `theme`, `layers`, `toggleLayer` |
| Selection | `selected`, `search`, `facilityFilter` |
| Study area | `studyArea`, `selectedState`, `selectedLga`, `setAdminSelection` |
| Viewport | `viewport` (bounds + zoom, written by the map) |
| Emergency | `userLocation`, `emergencyPoint`, `nearest`, `nearestLoading`, `nearestError`, `activeRoute` |
| UI | `panelOpen`, `navGuideOpen` |

`setAdminSelection` deliberately clears `selected` and `activeRoute` — a route or selection from a previous area is meaningless in a new one.

### TanStack Query

Owns everything fetched. See [data access layer](#data-access-layer).

### Derived state

Never stored. Scores, duplicates, connectivity and aggregates are recomputed with `useMemo` keyed on the query data:

```ts
const scored     = useMemo(() => scoreAll(healthcare.data), [healthcare.data]);
const duplicates = useMemo(() => detectDuplicates(scored), [scored]);
const agg        = useMemo(() => aggregate(scored, duplicates, disconnected), [scored, duplicates]);
```

## Data access layer

`src/hooks/useOverpass.ts` is the only place components fetch OSM data.

| Hook | Returns |
| --- | --- |
| `useLayerQuery(layer)` | Elements for one thematic layer, scoped and clipped |
| `useHealthcare()` | Hospitals + clinics + pharmacies + health centres + doctors combined |
| `useRoads()` | Road network for connectivity analysis and context |

Scoping rules (`useScope`):

- **Study area selected** → query the boundary bbox; all layers except buildings come from one bundled request; results are clipped by `pointInStudyArea`.
- **No study area** → query the current viewport, gated by `LAYER_MIN_ZOOM[layer]` and `LAYER_MAX_AREA[layer]`.

Cache keys embed either the study-area identity or a quantised bbox, so panning by a few pixels does not invalidate the cache.

## Map rendering

| Concern | Implementation |
| --- | --- |
| Container | `react-leaflet` `MapContainer`, centred on `OYO_CENTER` (`[9.08, 8.68]`, national view) |
| Tiles | `getBasemap(key)` from `src/lib/basemaps.ts`, with provider `maxZoom` and mandatory attribution |
| Clustering | `leaflet.markercluster` for facility layers |
| Boundary | `StudyAreaLayer` renders rings plus an out-of-area mask |
| Interaction | Click to select a feature; click to place the emergency point in emergency mode |
| Viewport sync | `moveend`/`zoomend` write `{ bounds, zoom }` into the store, which drives viewport-scoped queries |
| Route overlay | Polyline from `ActiveRoute.coords`, with start/destination markers |
| Geolocation | `navigator.geolocation` with an accuracy circle; position never leaves the browser |

Coordinate convention: application code uses `[lat, lng]`; OSRM URLs use `lng,lat`; GeoJSON uses `[lng, lat]`. Conversions are explicit at each boundary.

## Design system

All tokens live in `src/styles.css`:

- `@theme inline` maps CSS custom properties to Tailwind utilities.
- `:root` and `.dark` define oklch values.
- Adding a colour means editing all three blocks.

Rules enforced in review:

- No `text-white`, `bg-black` or `bg-[#hex]` in component `className`.
- New visual treatments become component variants, not one-off overrides.
- Keep `@import` rules at the top of the stylesheet; load web fonts via a `<link>` in `__root.tsx`, never a remote CSS `@import` (Tailwind v4's Lightning CSS resolves imports from the filesystem).

Theme switching is available through `toggleTheme` in the store, which toggles the `.dark` class on `documentElement`.

## Charts

Recharts on `/quality`: score distribution by band, average score by facility type, and issue frequency. Charts use `ResponsiveContainer` and read band colours from `BAND_COLOR` in `src/lib/quality.ts`, keeping map and chart colour semantics identical.

## Onboarding and guided tours

- First visit opens the module tour; the "seen" flag persists in `localStorage`.
- `HelpMenu` and `QuickStartChecklist` allow re-opening at any time.
- Steps anchor to `data-tour` attributes — when you move or rename an anchored element, update the tour script in the same commit or the step will silently fail to position.

## Accessibility

| Area | Status |
| --- | --- |
| Keyboard navigation | Radix primitives provide focus management, escape handling and roving tabindex |
| Semantic structure | One `<h1>` per route, landmark elements, labelled controls |
| Colour contrast | Quality bands are chosen for contrast in both themes |
| Motion | Animations are short and non-essential |
| Map accessibility | **Known gap** — Leaflet markers are not keyboard reachable; the tabular views are the accessible equivalent |
| Screen readers | Panels and tables are readable; map interactions are not announced |

Improvements are tracked in [future-roadmap.md](./future-roadmap.md).

## Error handling

| Failure | Handling |
| --- | --- |
| Query failure | 3 retries with exponential backoff, then an error state in the owning panel |
| Boundary not found | Toast via sonner; the previous view is retained |
| Routing failure | Toast plus an inline message in the navigation panel |
| Render error | Root `errorComponent` with "Try again" (router invalidate + reset) and "Go home" |
| Unknown route | Root `notFoundComponent` |
| Global capture | `src/lib/error-capture.ts` and `lovable-error-reporting.ts` |

## Extending the frontend

**Add a thematic layer**

1. Extend `LayerKey` and add the Overpass fragment in `src/lib/oyo.ts` (`buildLayerQuery`, `buildBundleQuery`, `layerOfElement`).
2. Set `LAYER_MIN_ZOOM` and `LAYER_MAX_AREA` for it.
3. Add the toggle to `LayerToggles` and its default in `src/lib/store.ts`.
4. Render it in `OyoMap.tsx` and expose the toggle in `LeftNav.tsx`.
5. Document it in [healthcare-module.md](./healthcare-module.md).

**Add a panel**

Create the component in the owning module folder, read state with selective Zustand selectors, mount it from the route shell, and add a `data-tour` anchor if it should appear in onboarding.

**Add a route**

Create `src/routes/<name>.tsx` with `createFileRoute` and its own `head()`, then link to it. Never edit `routeTree.gen.ts`.
