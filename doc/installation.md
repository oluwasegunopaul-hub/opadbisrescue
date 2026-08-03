# Installation Guide

[← Documentation index](../README.md#documentation)

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Clone the repository](#1-clone-the-repository)
- [2. Install dependencies](#2-install-dependencies)
- [3. Environment variables](#3-environment-variables)
- [4. Database setup](#4-database-setup)
- [5. Start the development server](#5-start-the-development-server)
- [6. Production build](#6-production-build)
- [7. Verification steps](#7-verification-steps)
- [Common installation problems](#common-installation-problems)

## Prerequisites

| Requirement | Minimum | Recommended | Check |
| --- | --- | --- | --- |
| Node.js | 20.x | 22.x LTS | `node -v` |
| Bun (preferred) | 1.1 | latest | `bun -v` |
| npm (alternative) | 10 | latest | `npm -v` |
| Git | 2.34 | latest | `git --version` |
| RAM | 4 GB | 8 GB+ | — |
| Disk | 1 GB free | 2 GB | — |
| Browser | Chrome/Edge 111, Firefox 115, Safari 16.4 | latest | — |

Network access is required to `overpass-api.de` (and mirrors), `nominatim.openstreetmap.org`, `router.project-osrm.org` and the tile CDNs. Behind a corporate proxy, allowlist these hosts before starting.

Bun is the reference toolchain (`bun.lock` is committed). npm works, but lockfile drift is your responsibility.

## 1. Clone the repository

```sh
git clone <repository-url>
cd opadbisrescue
```

## 2. Install dependencies

```sh
bun install
```

or

```sh
npm install
```

Expected: roughly 500 packages, under 60 seconds on a warm cache.

## 3. Environment variables

The application starts with **no configuration**. To customise endpoints or defaults:

```sh
cp .env.example .env
```

Then edit `.env`. Every variable is optional; see [configuration.md](./configuration.md) for the full reference. Never place secrets in `VITE_*` variables — they are inlined into the browser bundle.

## 4. Database setup

**No database is required.** The application is stateless and reads live data from OpenStreetMap services. There are no migrations, seeds, or connection strings.

If you plan to add persistence later, read [database.md](./database.md), which documents the current data-source strategy and a proposed schema.

## 5. Start the development server

```sh
bun run dev
```

The server listens on **http://localhost:8080** with hot module replacement.

First-run expectations:

1. The shell renders immediately; the map area shows "Initializing map…" until hydration completes.
2. The guided tour opens on first visit (dismissible; the preference is stored locally).
3. No data loads until you select a State — this is intentional, to avoid an unbounded national Overpass query.

## 6. Production build

```sh
bun run build      # optimised build
bun run preview    # serve the build locally for verification
```

For a development-mode build (useful when debugging prerender failures):

```sh
bun run build:dev
```

Deployment targets and hosting requirements: [deployment.md](./deployment.md).

## 7. Verification steps

Work through this list after any installation:

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open http://localhost:8080 | Header reads "opadbisrescue"; no console errors |
| 2 | Open the left navigation | State selector lists 36 states + FCT |
| 3 | Select `Oyo` → `Ibadan North` | Boundary polygon renders within ~10 s |
| 4 | Observe the KPI bar | Facility counts become non-zero |
| 5 | Toggle the `Pharmacies` layer off and on | Markers disappear and reappear |
| 6 | Switch basemap to `Esri World Imagery` | Satellite tiles load |
| 7 | Click **Locate me** (grant permission) | Accuracy circle appears at your position |
| 8 | Drop an emergency point on the map | Nearest hospital/clinic/pharmacy/ambulance listed with distances |
| 9 | Start navigation to the nearest hospital | Route polyline plus turn-by-turn list appears |
| 10 | Navigate to `/quality` | Facilities are scored and banded; charts render |
| 11 | Export CSV from the quality dashboard | A `.csv` file downloads with one row per facility |
| 12 | Run `bun run lint` | No errors |
| 13 | Run `bun run build` | Build completes successfully |

If step 3 or 4 fails, jump to [troubleshooting.md](./troubleshooting.md#no-data-loads-after-selecting-a-state).

## Common installation problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `EADDRINUSE: 8080` | Port already bound | `PORT=3000 bun run dev` or stop the other process |
| Peer dependency errors on npm | React 19 peer ranges | `npm install --legacy-peer-deps`, or switch to Bun |
| Map area stays blank | Leaflet CSS not loaded, or SSR-time import of a map module | Confirm the map component is imported lazily behind `useHydrated()` |
| `fetch failed` on boundary lookup | Proxy blocking `nominatim.openstreetmap.org` | Allowlist the host, or set `NOMINATIM_BASE_URL` to an internal instance |
| Overpass returns 429 | Shared-mirror rate limiting | Wait, reduce the study area, or self-host Overpass |
| TypeScript path aliases unresolved | Editor not using the workspace TS version | Point your editor at the workspace `typescript` and reload |

More: [troubleshooting.md](./troubleshooting.md).
