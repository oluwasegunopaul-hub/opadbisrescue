import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  ScaleControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { OYO_CENTER } from "@/lib/oyo";
import { BAND_COLOR, BAND_LABEL, type FacilityScore, osmUrl, idEditorUrl } from "@/lib/quality";
import { useStore } from "@/lib/store";
import { getBasemap } from "@/lib/basemaps";
import StudyAreaLayer from "@/components/shared/StudyAreaLayer";

type Props = {
  scored: FacilityScore[];
  focus: FacilityScore | null;
  onSelect: (f: FacilityScore) => void;
};

function ViewportSync() {
  const setViewport = useStore((s) => s.setViewport);
  const map = useMapEvents({
    moveend() {
      const b = map.getBounds();
      setViewport({
        bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
        zoom: map.getZoom(),
      });
    },
    load() {
      const b = map.getBounds();
      setViewport({
        bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
        zoom: map.getZoom(),
      });
    },
  });
  useEffect(() => {
    const b = map.getBounds();
    setViewport({
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      zoom: map.getZoom(),
    });
  }, [map, setViewport]);
  return null;
}

function FocusFlyTo({ focus }: { focus: FacilityScore | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.coords) map.flyTo(focus.coords, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

/** Shared user position (set by "Locate me" on either page). */
function UserLocationLayer() {
  const map = useMap();
  const user = useStore((s) => s.userLocation);
  useEffect(() => {
    if (!user) return;
    const halo = L.circle([user.lat, user.lng], {
      radius: Math.max(user.accuracy || 0, 30),
      color: "#2563eb",
      weight: 1,
      fillColor: "#2563eb",
      fillOpacity: 0.12,
    }).addTo(map);
    const dot = L.circleMarker([user.lat, user.lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip("Your location");
    map.flyTo([user.lat, user.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    return () => {
      map.removeLayer(halo);
      map.removeLayer(dot);
    };
  }, [user, map]);
  return null;
}

function QualityMarkers({
  scored,
  onSelect,
}: {
  scored: FacilityScore[];
  onSelect: (f: FacilityScore) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers() as (L.Marker & {
          options: { qualityScore?: number };
        })[];
        const scores = markers.map((m) => m.options.qualityScore ?? 0).filter((n) => n > 0);
        const avg = scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        const color =
          avg >= 90
            ? BAND_COLOR.excellent
            : avg >= 75
              ? BAND_COLOR.good
              : avg >= 50
                ? BAND_COLOR.needs
                : BAND_COLOR.critical;
        return L.divIcon({
          className: "quality-cluster",
          html: `<div style="background:${color};color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:3px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,.3)">${cluster.getChildCount()}</div>`,
          iconSize: [38, 38],
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    const markers: L.Marker[] = [];
    for (const f of scored) {
      if (!f.coords) continue;
      const color = BAND_COLOR[f.band];
      const icon = L.divIcon({
        className: "quality-marker",
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker(f.coords, { icon, qualityScore: f.score } as L.MarkerOptions & {
        qualityScore: number;
      });
      const tags = f.element.tags || {};
      marker.bindPopup(
        `<div style="font-size:12px;min-width:220px">
          <div style="font-weight:600;font-size:14px">${escapeHtml(f.name)}</div>
          <div style="color:#64748b;text-transform:capitalize">${f.facilityType.replace("_", " ")}</div>
          <div style="margin-top:6px"><span style="background:${color};color:white;padding:2px 6px;border-radius:4px;font-weight:600">${f.score} · ${BAND_LABEL[f.band]}</span></div>
          <div style="margin-top:6px"><b>Missing:</b> ${f.missingTags.slice(0, 6).join(", ") || "—"}</div>
          ${tags.phone ? `<div><b>Phone:</b> ${escapeHtml(tags.phone)}</div>` : ""}
          ${tags.opening_hours ? `<div><b>Hours:</b> ${escapeHtml(tags.opening_hours)}</div>` : ""}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <a href="${osmUrl(f.element)}" target="_blank" rel="noopener" style="color:#2563eb">OSM</a>
            <a href="${idEditorUrl(f.element)}" target="_blank" rel="noopener" style="color:#2563eb">iD Editor</a>
          </div>
        </div>`,
      );
      marker.on("click", () => onSelect(f));
      markers.push(marker);
    }
    group.addLayers(markers);
  }, [scored, onSelect]);

  return null;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export default function QualityMap({ scored, focus, onSelect }: Props) {
  const basemap = useStore((s) => s.basemap);
  const tile = getBasemap(basemap);
  const scoredWithCoords = useMemo(() => scored.filter((s) => s.coords), [scored]);

  return (
    <MapContainer
      center={OYO_CENTER}
      zoom={7}
      className="h-full w-full"
      zoomControl={false}
      preferCanvas
    >
      <TileLayer key={basemap} url={tile.url} attribution={tile.attr} maxZoom={tile.maxZoom} />
      <ZoomControl position="topright" />
      <ScaleControl position="bottomleft" />
      <StudyAreaLayer />
      <ViewportSync />
      <FocusFlyTo focus={focus} />
      <UserLocationLayer />
      <QualityMarkers scored={scoredWithCoords} onSelect={onSelect} />
    </MapContainer>
  );
}
