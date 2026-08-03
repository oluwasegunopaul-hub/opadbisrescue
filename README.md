# opadbisrescue

**Healthcare Accessibility & Emergency Response Dashboard + OpenStreetMap Data Quality Dashboard**

An enterprise-grade, browser-based GIS platform that maps healthcare accessibility and emergency response capacity across all 36 Nigerian states and the FCT, and continuously audits the quality of the underlying OpenStreetMap (OSM) healthcare data.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TanStack Start](https://img.shields.io/badge/TanStack%20Start-v1-blue.svg)](https://tanstack.com/start)
[![Data: OpenStreetMap](https://img.shields.io/badge/data-OpenStreetMap-7EBC6F.svg)](https://www.openstreetmap.org/copyright)

---

## Table of Contents

- [Description](#description)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Building for Production](#building-for-production)
- [Deployment](#deployment)
- [Folder Structure](#folder-structure)
- [Documentation](#documentation)
- [License](#license)
- [Credits](#credits)
- [Contributors](#contributors)

---

## Description

Health planning in Nigeria is constrained less by analytical capacity than by the availability of trustworthy spatial data about where health facilities actually are, what they offer, and whether people can physically reach them in an emergency.

opadbisrescue addresses both halves of that problem in a single application:

1. **Healthcare Accessibility & Emergency Response** — an interactive map and analytics workspace that pulls live OpenStreetMap healthcare data for any selected State or Local Government Area (LGA), computes accessibility indicators, finds the nearest hospital / clinic / pharmacy / ambulance station to any point, and produces turn-by-turn emergency navigation.
2. **OSM Data Quality** — a data-quality intelligence dashboard that scores every mapped facility against a documented completeness rubric, detects probable duplicates, flags facilities disconnected from the mapped road network, and hands contributors a prioritised, deep-linked worklist for iD or JOSM.

The application is fully client-driven with a thin server-function layer for outbound OSM API calls. It requires **no database, no accounts and no API keys** to run.

## Objectives

- Make healthcare accessibility gaps in Nigeria visible at State and LGA resolution.
- Reduce emergency response time by exposing nearest-facility routing to any location.
- Quantify and continuously monitor the quality of OSM healthcare data.
- Convert data-quality findings into concrete, one-click OSM editing tasks.
- Provide exportable, citable evidence (CSV, GeoJSON, JSON, HTML) for planners and researchers.
- Remain free, open, dependency-light and deployable by any organisation.

## Key Features

### Healthcare Accessibility & Emergency Response

| Feature | Summary |
| --- | --- |
| Interactive map | Leaflet map with clustering, hover/selection state and live OSM data |
| State & LGA selection | All 36 states + FCT, 770+ LGAs; real administrative boundary fetched from OSM |
| Locate Me | Browser geolocation with accuracy circle |
| Nearest facility search | Expanding-radius Overpass search (5/10/25/50 km) for hospital, clinic, pharmacy, ambulance |
| Emergency navigation | OSRM routing with driving/walking/cycling profiles and turn-by-turn instructions |
| Healthcare search & filter | Free-text search plus facility-type filtering |
| Layer management | 10 toggleable thematic layers with zoom/area guards |
| Basemaps | OSM Standard, OSM Humanitarian, Esri World Imagery (satellite), Carto Light, Carto Dark |
| Analytics | KPI bar, facility mix, coverage and density statistics |
| Accessibility analysis | Distance-to-nearest-facility and coverage indicators clipped to the study area |
| Guided tour | First-visit onboarding tour and quick-start checklist |

### OSM Data Quality

| Feature | Summary |
| --- | --- |
| Quality dashboard | Weighted 0–100 score per facility, banded excellent/good/needs work/critical |
| Missing tags analysis | Attribute, contact, address, accessibility and emergency tag gaps |
| Duplicate detection | Spatial-grid candidate pairs with distance + name-similarity confidence |
| Road connectivity | Flags facilities more than 150 m from any mapped highway |
| Quality score | Documented weighting: attributes 28%, contact 22%, address 20%, consistency 20%, geometry 10% |
| Charts | Recharts distributions by band, facility type and issue frequency |
| Reports & export | CSV, GeoJSON, issues JSON and a standalone HTML report |
| Contribution guidance | Per-issue suggestions plus deep links to osm.org, iD editor and JOSM remote control |

See [docs/healthcare-module.md](./docs/healthcare-module.md) and [docs/data-quality-module.md](./docs/data-quality-module.md) for feature-by-feature detail.

## Screenshots

> Replace the placeholders below with real captures (`docs/assets/`) once available.

| View | Placeholder |
| --- | --- |
| Accessibility dashboard | `![Accessibility dashboard](docs/assets/screenshot-dashboard.png)` |
| Emergency navigation | `![Emergency navigation](docs/assets/screenshot-navigation.png)` |
| OSM data quality | `![Data quality](docs/assets/screenshot-quality.png)` |
| Quality report export | `![HTML report](docs/assets/screenshot-report.png)` |

## Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (SSR + server functions) |
| Router | TanStack Router (file-based) |
| UI | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI primitives, lucide-react |
| State | Zustand (UI/session state), TanStack Query (server cache) |
| Mapping | Leaflet 1.9, react-leaflet 5, leaflet.markercluster |
| Charts | Recharts |
| Validation | Zod |
| Data | OpenStreetMap via Overpass API, Nominatim, OSRM |
| Build | Vite 8, Bun |
| Tooling | ESLint 9, Prettier, TypeScript ESLint |
| Hosting | Edge/serverless worker runtime (Cloudflare Workers compatible) |

Rationale for each choice: [docs/system-architecture.md](./docs/system-architecture.md#technology-selection-rationale).

## Quick Start

```sh
git clone <repository-url>
cd opadbisrescue
bun install       # or: npm install
bun run dev       # or: npm run dev
```

Open http://localhost:8080.

## Environment Setup

The application runs with **zero required environment variables**. Optional overrides are documented in [`.env.example`](./.env.example) and [docs/configuration.md](./docs/configuration.md).

```sh
cp .env.example .env   # optional
```

## Running Locally

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the dev server with HMR on port 8080 |
| `bun run lint` | Run ESLint across the repository |
| `bun run format` | Apply Prettier formatting |
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build (useful for prerender debugging) |
| `bun run preview` | Serve the production build locally |

## Building for Production

```sh
bun run build
bun run preview
```

## Deployment

The build output targets an edge worker runtime. Full instructions, environment matrix, rollback and post-deploy verification: [docs/deployment.md](./docs/deployment.md) and [docs/deployment-checklist.md](./docs/deployment-checklist.md).

## Folder Structure

```text
.
├── docs/                     # Full project documentation
├── public/                   # Static assets served as-is
├── src/
│   ├── components/
│   │   ├── gis/              # Accessibility dashboard UI
│   │   ├── quality/          # Data quality dashboard UI
│   │   ├── shared/           # Basemap gallery, admin selector, study area layer
│   │   ├── tour/             # Guided tour engine and tour definitions
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # useOverpass, use-hydrated, use-mobile
│   ├── lib/                  # Domain logic, server functions, exports, store
│   ├── routes/               # File-based routes (/, /quality)
│   ├── router.tsx            # Router + QueryClient factory
│   ├── server.ts             # Server entry
│   ├── start.ts              # Start runtime configuration
│   └── styles.css            # Design system tokens
└── vite.config.ts
```

Annotated tree: [docs/folder-structure.md](./docs/folder-structure.md).

## Documentation

| Document | Contents |
| --- | --- |
| [Project overview](./docs/project-overview.md) | Problem, users, use cases, scope, limitations |
| [System architecture](./docs/system-architecture.md) | Context, component, data-flow, sequence, deployment diagrams |
| [Installation](./docs/installation.md) | Prerequisites through verification |
| [Configuration](./docs/configuration.md) | Environment variables and tunable constants |
| [Deployment](./docs/deployment.md) | Dev/staging/production deployment |
| [Workflow](./docs/workflow.md) | Git strategy, releases, bug reports, doc upkeep |
| [API reference](./docs/api-reference.md) | Server functions and external endpoints |
| [Authentication](./docs/authentication.md) | Current public-access model and future auth design |
| [Database](./docs/database.md) | Data sources and storage strategy (no database today) |
| [User roles](./docs/user-roles.md) | Personas and permissions |
| [Folder structure](./docs/folder-structure.md) | Annotated tree |
| [Frontend](./docs/frontend.md) | Components, state, styling |
| [Backend](./docs/backend.md) | Server functions and runtime constraints |
| [OSM integration](./docs/osm-integration.md) | Overpass, Nominatim, OSRM, tiles |
| [Healthcare module](./docs/healthcare-module.md) | Accessibility feature reference |
| [Data quality module](./docs/data-quality-module.md) | Scoring rubric and detectors |
| [Troubleshooting](./docs/troubleshooting.md) | Symptoms, causes, fixes |
| [Performance](./docs/performance.md) | Budgets and optimisation |
| [Security](./docs/security.md) | Threat model and controls |
| [Testing](./docs/testing.md) | Strategy and recommended stack |
| [Deployment checklist](./docs/deployment-checklist.md) | Pre/post release gates |
| [Future roadmap](./docs/future-roadmap.md) | Short, medium and long term |
| [Architecture diagrams](./docs/architecture-diagrams.md) | All Mermaid diagrams in one place |

Also see [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) and [CHANGELOG.md](./CHANGELOG.md).

## License

Released under the [MIT License](./LICENSE).

OpenStreetMap data is © OpenStreetMap contributors and licensed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). Any derived database published from this application must carry the same licence and attribution.

## Credits

- **OpenStreetMap contributors** — all facility, road and boundary data.
- **Overpass API** maintainers (overpass-api.de, kumi.systems, maps.mail.ru, private.coffee).
- **Nominatim** — administrative boundary geocoding.
- **Project OSRM** — routing engine.
- **Humanitarian OpenStreetMap Team**, **CARTO** and **Esri** — basemap tiles.
- **shadcn/ui**, **Radix UI**, **Leaflet**, **TanStack** — application foundations.

## Contributors

| Name | Role |
| --- | --- |
| _Project maintainer_ | Architecture, GIS modelling, implementation |
| _Open to contributors_ | See [CONTRIBUTING.md](./CONTRIBUTING.md) |
