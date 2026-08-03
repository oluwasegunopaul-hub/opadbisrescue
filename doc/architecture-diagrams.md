# Architecture Diagrams

[← Documentation index](../README.md#documentation)

Consolidated diagram reference. Narrative context lives in [system-architecture.md](./system-architecture.md).

## System context

```mermaid
flowchart TB
  U[Users: planners, responders, researchers, OSM contributors]
  A[opadbisrescue]
  O[Overpass API mirrors]
  N[Nominatim geocoding]
  R[OSRM routing]
  T[Tile providers]
  U --> A
  A --> O
  A --> N
  A --> R
  A --> T
```

## Container view

```mermaid
flowchart TB
  subgraph Browser
    UI[React 19 UI]
    MAP[Leaflet map]
    ST[Client state and query cache]
  end
  subgraph Edge worker
    SSR[SSR renderer]
    SF[Server functions / OSM proxies]
  end
  UI --> ST --> SF
  UI --> MAP
  SSR --> UI
  SF --> EXT[(Public OSM services)]
  MAP --> TILES[(Tile providers)]
```

## Study-area data flow

```mermaid
sequenceDiagram
  participant U as User
  participant C as Client
  participant S as Server function
  participant N as Nominatim
  participant O as Overpass
  U->>C: Select state and LGA
  C->>S: Resolve boundary
  S->>N: Geocode admin area
  alt Found
    N-->>S: Polygon
  else Not found
    S->>O: Fetch admin relation
    O-->>S: Stitched rings
  end
  S-->>C: Boundary + bbox
  C->>S: Bundled layer query
  S->>O: Single Overpass request
  O-->>S: All layers
  S-->>C: Elements
  C->>C: Render, score, aggregate
```

## Quality analysis pipeline

```mermaid
flowchart LR
  E[Facility elements] --> S[scoreFacility]
  S --> D[detectDuplicates]
  S --> K[roadConnectivity]
  S --> G[aggregate]
  D --> G
  K --> G
  G --> V[KPIs and charts]
  S --> W[Filtered worklist]
  W --> X[iD / JOSM deep links]
  G --> Y[CSV / GeoJSON / JSON / HTML]
```

## Emergency response flow

```mermaid
flowchart TD
  P[Emergency point: locate or click] --> Q[Filter facilities by radius]
  Q --> R[Rank by distance]
  R --> S{Route requested?}
  S -->|No| T[Show nearest list]
  S -->|Yes| U[OSRM route]
  U --> V[Draw route and turn-by-turn steps]
```

## Resilience: mirror failover

```mermaid
flowchart LR
  A[Request] --> M1{Mirror 1}
  M1 -->|OK| Z[Return]
  M1 -->|Timeout / 429 / 5xx| M2{Mirror 2}
  M2 -->|OK| Z
  M2 -->|Fail| M3{Mirror 3}
  M3 -->|OK| Z
  M3 -->|Fail| E[Surface actionable error]
```

## Deployment topology

```mermaid
flowchart LR
  DEV[Local dev :8080] --> PR[Pull request]
  PR --> DEVELOP[develop / staging]
  DEVELOP --> MAIN[main]
  MAIN --> EDGE[Edge worker + CDN assets]
  EDGE --> PUB[(Public OSM services)]
```
