import type { BasemapKey } from "./store";

export type BasemapDef = {
  key: BasemapKey;
  label: string;
  blurb: string;
  url: string;
  attr: string;
  maxZoom: number;
  swatch: string;
};

export const BASEMAP_LIST: BasemapDef[] = [
  {
    key: "osm",
    label: "OpenStreetMap Standard",
    blurb: "Default OSM carto style",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap contributors",
    maxZoom: 19,
    swatch: "linear-gradient(135deg,#e8e0d8,#c8dcb4)",
  },
  {
    key: "hot",
    label: "OpenStreetMap Humanitarian",
    blurb: "HOT style, tuned for field mapping",
    url: "https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap · Humanitarian OSM Team",
    maxZoom: 20,
    swatch: "linear-gradient(135deg,#f3ece2,#d8c9a8)",
  },
  {
    key: "esri-imagery",
    label: "Esri World Imagery",
    blurb: "High-resolution satellite imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
    swatch: "linear-gradient(135deg,#28402c,#6b7a4a)",
  },
  {
    key: "carto-light",
    label: "Carto Light",
    blurb: "Minimal light canvas for data overlays",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_3r9t_1_443b5e61568b6c47a9ab22fe",
    attr: "© OSM · © CARTO",
    maxZoom: 20,
    swatch: "linear-gradient(135deg,#ffffff,#e2e8f0)",
  },
  {
    key: "carto-dark",
    label: "Carto Dark",
    blurb: "Dark canvas for high-contrast analysis",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3r9t_1_443b5e61568b6c47a9ab22fe",
    attr: "© OSM · © CARTO",
    maxZoom: 20,
    swatch: "linear-gradient(135deg,#1e293b,#0f172a)",
  },
];

export const BASEMAPS: Record<BasemapKey, BasemapDef> = Object.fromEntries(
  BASEMAP_LIST.map((b) => [b.key, b]),
) as Record<BasemapKey, BasemapDef>;

export function getBasemap(key: string): BasemapDef {
  return BASEMAPS[key as BasemapKey] ?? BASEMAPS["carto-light"];
}
