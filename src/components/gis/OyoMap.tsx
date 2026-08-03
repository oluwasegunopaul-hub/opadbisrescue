import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ScaleControl,
  ZoomControl,
  Marker,
  Popup,
  Polyline,
  GeoJSON,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useStore } from "@/lib/store";
import {
  useHealthcare,
  useEmergency,
  useSettlements,
  useTransport,
  useRoads,
  useBoundary,
  useLayerQuery,
  classifyFacility,
} from "@/hooks/useOverpass";
import {
  OYO_CENTER,
  elementCoords,
  haversine,
  LAYER_MIN_ZOOM,
  type OverpassElement,
  type BBox,
  type LayerKey,
} from "@/lib/oyo";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import { LocateMeButton, NearestFacilitiesPanel } from "./NearestPanel";
import NavigationGuide from "./NavigationGuide";
import { getBasemap } from "@/lib/basemaps";
import BasemapGallery from "@/components/shared/BasemapGallery";
import StudyAreaLayer, { StudyAreaBadge } from "@/components/shared/StudyAreaLayer";

function icon(color: string, glyph = "") {
  return L.divIcon({
    className: "gis-marker",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:700;">${glyph}</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
}

const ICONS: Record<string, L.DivIcon> = {
  hospital: icon("#dc2626", "H"),
  clinic: icon("#2563eb", "C"),
  pharmacy: icon("#16a34a", "P"),
  health_centre: icon("#7c3aed", "+"),
  doctors: icon("#0891b2", "D"),
  ambulance: icon("#ea580c", "A"),
  settlement: icon("#334155", "•"),
  transport: icon("#6b7280", "T"),
  emergency: icon("#ef4444", "!"),
};

function popupHtml(el: OverpassElement): string {
  const t = el.tags || {};
  const na = (v?: string) => v || "Not Available";
  const c = elementCoords(el);
  const kind = classifyFacility(el).replace("_", " ");
  return `
    <div style="font-size:12px;min-width:220px">
      <div style="font-weight:600;font-size:14px">${na(t.name)}</div>
      <div style="text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-size:10px">${kind}</div>
      <div style="display:grid;grid-template-columns:auto 1fr;column-gap:6px;row-gap:2px;padding-top:6px">
        <span style="color:#64748b">Operator</span><span>${na(t.operator)}</span>
        <span style="color:#64748b">Hours</span><span>${na(t.opening_hours)}</span>
        <span style="color:#64748b">Phone</span><span>${na(t.phone || t["contact:phone"])}</span>
        <span style="color:#64748b">Emergency</span><span>${na(t.emergency)}</span>
        <span style="color:#64748b">Wheelchair</span><span>${na(t.wheelchair)}</span>
        <span style="color:#64748b">Address</span><span>${na(t["addr:street"] || t["addr:full"])}</span>
        <span style="color:#64748b">Lat / Lng</span><span>${c ? `${c[0].toFixed(5)}, ${c[1].toFixed(5)}` : "—"}</span>
      </div>
    </div>`;
}

// ---------------- Viewport tracker (debounced) ----------------
function ViewportSync() {
  const setViewport = useStore((s) => s.setViewport);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (map: L.Map) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const b = map.getBounds();
      const bbox: BBox = {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      };
      setViewport({ bounds: bbox, zoom: map.getZoom() });
    }, 500);
  };

  const map = useMapEvents({
    moveend: () => push(map),
    zoomend: () => push(map),
  });

  useEffect(() => {
    // Initial push
    const b = map.getBounds();
    setViewport({
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      zoom: map.getZoom(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function ClickHandler() {
  const setEmergencyPoint = useStore((s) => s.setEmergencyPoint);
  const nav = useStore((s) => s.nav);
  useMapEvents({
    click: (e) => {
      if (nav === "emergency") setEmergencyPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function MapRefCapture({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

// LocateBtn removed — replaced by LocateMeButton from NearestPanel.tsx

const CAT_COLORS: Record<string, string> = {
  hospital: "#dc2626",
  clinic: "#16a34a",
  pharmacy: "#2563eb",
  ambulance: "#ea580c",
};

function pulseIcon() {
  return L.divIcon({
    className: "user-pulse-marker",
    html: `<div style="position:relative;width:22px;height:22px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:#3b82f6;opacity:.35;animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;inset:6px;border-radius:9999px;background:#2563eb;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}</style>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function categoryIcon(cat: string) {
  const color = CAT_COLORS[cat] || "#334155";
  return L.divIcon({
    className: "cat-marker",
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.4);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function LocateOverlays() {
  const user = useStore((s) => s.userLocation);
  const nearest = useStore((s) => s.nearest);
  const route = useStore((s) => s.activeRoute);
  const map = useMap();

  // Fit map when user location arrives
  useEffect(() => {
    if (user) {
      map.flyTo([user.lat, user.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [user, map]);

  // Fly to a manually entered coordinate
  useEffect(() => {
    const handler = (e: Event) => {
      const p = (e as CustomEvent<[number, number]>).detail;
      if (Array.isArray(p)) map.flyTo(p, Math.max(map.getZoom(), 13), { duration: 0.8 });
    };
    window.addEventListener("opadbisrescue:goto", handler);
    return () => window.removeEventListener("opadbisrescue:goto", handler);
  }, [map]);

  // Fit map to route bounds when a route is drawn
  useEffect(() => {
    if (route && route.coords.length > 1) {
      const b = L.latLngBounds(route.coords as L.LatLngExpression[]);
      map.fitBounds(b, { padding: [80, 80], maxZoom: 15 });
    }
  }, [route, map]);

  return (
    <>
      {user && (
        <>
          <Marker position={[user.lat, user.lng]} icon={pulseIcon()}>
            <Popup>You are here.</Popup>
          </Marker>
          <Circle
            center={[user.lat, user.lng]}
            radius={Math.max(user.accuracy, 30)}
            pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.08 }}
          />
        </>
      )}
      {nearest &&
        Object.values(nearest).map((hit) =>
          hit ? (
            <Marker
              key={`${hit.category}-${hit.element.id}`}
              position={hit.coords}
              icon={categoryIcon(hit.category)}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-semibold">{hit.element.tags?.name || "Unnamed"}</div>
                  <div className="capitalize text-muted-foreground">{hit.category}</div>
                  <div>{hit.distanceKm.toFixed(2)} km from you</div>
                </div>
              </Popup>
            </Marker>
          ) : null,
        )}
      {route && route.coords.length > 1 && (
        <>
          <Polyline
            positions={route.coords as L.LatLngExpression[]}
            pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.85 }}
          />
          <Polyline
            positions={route.coords as L.LatLngExpression[]}
            pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.95 }}
          />
        </>
      )}
    </>
  );
}

function FullscreenBtn({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [full, setFull] = useState(false);
  return (
    <Button
      size="icon"
      variant="secondary"
      className="shadow-md"
      onClick={async () => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
          await el.requestFullscreen?.();
          setFull(true);
        } else {
          await document.exitFullscreen?.();
          setFull(false);
        }
      }}
      title="Fullscreen"
    >
      {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );
}

// ---------------- Clustered marker layer ----------------
type ClusterPoint = { el: OverpassElement; pos: [number, number]; iconKey: string };

function ClusterLayer({
  points,
  onSelect,
}: {
  points: ClusterPoint[];
  onSelect: (el: OverpassElement) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const group = (
      L as unknown as { markerClusterGroup: (opts: unknown) => L.LayerGroup }
    ).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
    });
    for (const p of points) {
      const m = L.marker(p.pos, { icon: ICONS[p.iconKey] || ICONS.hospital });
      m.on("click", () => onSelect(p.el));
      m.bindPopup(() => popupHtml(p.el));
      group.addLayer(m);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [points, map, onSelect]);
  return null;
}

// ---------------- Per-layer components ----------------
function HealthcareLayer({ onSelect }: { onSelect: (el: OverpassElement) => void }) {
  const { data } = useHealthcare();
  const layers = useStore((s) => s.layers);
  const facilityFilter = useStore((s) => s.facilityFilter);
  const search = useStore((s) => s.search);

  const points = useMemo<ClusterPoint[]>(() => {
    const out: ClusterPoint[] = [];
    for (const el of data) {
      const kind = classifyFacility(el);
      const layerOn =
        (kind === "hospital" && layers.hospitals) ||
        (kind === "clinic" && layers.clinics) ||
        (kind === "pharmacy" && layers.pharmacies) ||
        (kind === "health_centre" && layers.healthCentres) ||
        (kind === "doctors" && layers.doctors);
      if (!layerOn) continue;
      if (facilityFilter !== "all" && kind !== facilityFilter) continue;
      if (search && !(el.tags?.name || "").toLowerCase().includes(search.toLowerCase())) continue;
      const c = elementCoords(el);
      if (!c) continue;
      out.push({ el, pos: c, iconKey: kind });
    }
    return out;
  }, [data, layers, facilityFilter, search]);

  return <ClusterLayer points={points} onSelect={onSelect} />;
}

function EmergencyLayer({ onSelect }: { onSelect: (el: OverpassElement) => void }) {
  const on = useStore((s) => s.layers.emergency);
  const { data } = useEmergency();
  const points = useMemo<ClusterPoint[]>(() => {
    if (!on || !data) return [];
    return data
      .map((el) => {
        const c = elementCoords(el);
        return c ? { el, pos: c, iconKey: "ambulance" } : null;
      })
      .filter(Boolean) as ClusterPoint[];
  }, [on, data]);
  return <ClusterLayer points={points} onSelect={onSelect} />;
}

function SettlementsLayer() {
  const on = useStore((s) => s.layers.settlements);
  const { data } = useSettlements();
  if (!on || !data) return null;
  return (
    <>
      {data.map((el) => {
        const c = elementCoords(el);
        if (!c) return null;
        return (
          <Marker key={`v-${el.id}`} position={c} icon={ICONS.settlement}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{el.tags?.name || "Settlement"}</div>
                <div className="text-xs text-muted-foreground capitalize">{el.tags?.place}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function TransportLayer() {
  const on = useStore((s) => s.layers.transport);
  const { data } = useTransport();
  const points = useMemo<ClusterPoint[]>(() => {
    if (!on || !data) return [];
    return data
      .map((el) => {
        const c = elementCoords(el);
        return c ? { el, pos: c, iconKey: "transport" } : null;
      })
      .filter(Boolean) as ClusterPoint[];
  }, [on, data]);
  return <ClusterLayer points={points} onSelect={() => {}} />;
}

function RoadsLayer({ onSelect }: { onSelect: (el: OverpassElement) => void }) {
  const on = useStore((s) => s.layers.roads);
  const { data } = useRoads();
  if (!on || !data) return null;
  return (
    <>
      {data.slice(0, 1500).map((w) =>
        w.geometry ? (
          <Polyline
            key={w.id}
            positions={w.geometry.map((g) => [g.lat, g.lon]) as L.LatLngExpression[]}
            pathOptions={{
              color:
                w.tags?.highway === "motorway"
                  ? "#7c2d12"
                  : w.tags?.highway === "trunk"
                    ? "#b45309"
                    : w.tags?.highway === "primary"
                      ? "#ea580c"
                      : "#f59e0b",
              weight: w.tags?.highway === "motorway" || w.tags?.highway === "trunk" ? 3 : 2,
              opacity: 0.75,
            }}
            eventHandlers={{ click: () => onSelect(w) }}
          />
        ) : null,
      )}
    </>
  );
}

// ---------------- Loading indicator per layer ----------------
function LayerLoading() {
  const viewport = useStore((s) => s.viewport);
  const layers = useStore((s) => s.layers);
  const area = useStore((s) => s.studyArea);
  const zoom = area ? 99 : (viewport?.zoom ?? 0);

  const hospitals = useLayerQuery("hospitals");
  const clinics = useLayerQuery("clinics");
  const pharmacies = useLayerQuery("pharmacies");
  const roads = useLayerQuery("roads");
  const emergency = useLayerQuery("emergency");

  const items: {
    label: string;
    on: boolean;
    loading: boolean;
    error: unknown;
    minZoom: number;
    count?: number;
  }[] =
    [
      {
        label: "Hospitals",
        on: layers.hospitals,
        loading: hospitals.isFetching,
        error: hospitals.error,
        minZoom: LAYER_MIN_ZOOM.hospitals,
        count: hospitals.data?.length,
      },
      {
        label: "Clinics",
        on: layers.clinics,
        loading: clinics.isFetching,
        error: clinics.error,
        minZoom: LAYER_MIN_ZOOM.clinics,
        count: clinics.data?.length,
      },
      {
        label: "Pharmacies",
        on: layers.pharmacies,
        loading: pharmacies.isFetching,
        error: pharmacies.error,
        minZoom: LAYER_MIN_ZOOM.pharmacies,
        count: pharmacies.data?.length,
      },
      {
        label: "Roads",
        on: layers.roads,
        loading: roads.isFetching,
        error: roads.error,
        minZoom: LAYER_MIN_ZOOM.roads,
        count: roads.data?.length,
      },
      {
        label: "Ambulance",
        on: layers.emergency,
        loading: emergency.isFetching,
        error: emergency.error,
        minZoom: LAYER_MIN_ZOOM.emergency,
        count: emergency.data?.length,
      },
    ];

  const active = items.filter((i) => i.on);
  if (active.length === 0) return null;

  return (
    <div className="absolute top-3 right-16 z-[400] flex flex-col gap-1 rounded-md bg-background/90 border px-3 py-2 text-[11px] shadow max-w-[220px]">
      {active.map((i) => {
        const gated = zoom < i.minZoom;
        const empty = !gated && !i.loading && !i.error && (i.count ?? 0) === 0;
        return (
          <div key={i.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{i.label}</span>
            {gated ? (
              <span className="text-muted-foreground">zoom ≥ {i.minZoom}</span>
            ) : i.loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : i.error ? (
              <span className="text-destructive">retrying…</span>
            ) : empty ? (
              <span className="text-muted-foreground">none found</span>
            ) : (
              <span className="text-emerald-600">ready</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OyoMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mouse, setMouse] = useState<[number, number] | null>(null);

  const basemap = useStore((s) => s.basemap);
  const layers = useStore((s) => s.layers);
  const setSelected = useStore((s) => s.setSelected);
  const emergencyPoint = useStore((s) => s.emergencyPoint);
  const boundary = useBoundary();
  const studyArea = useStore((s) => s.studyArea);
  const tile = getBasemap(basemap);

  const healthcare = useHealthcare();

  // Emergency route: nearest hospital straight-line (over currently loaded data)
  const emergencyRoute = useMemo(() => {
    if (!emergencyPoint || !healthcare.data.length) return null;
    const hospitals = healthcare.data.filter((e) => classifyFacility(e) === "hospital");
    let best: { el: OverpassElement; d: number; c: [number, number] } | null = null;
    for (const h of hospitals) {
      const c = elementCoords(h);
      if (!c) continue;
      const d = haversine(emergencyPoint, c);
      if (!best || d < best.d) best = { el: h, d, c };
    }
    return best;
  }, [emergencyPoint, healthcare.data]);

  return (
    <div ref={containerRef} data-tour="map" className="relative h-full w-full bg-background">
      <MapContainer
        center={OYO_CENTER}
        zoom={6}
        minZoom={5}
        maxZoom={18}
        zoomControl={false}
        preferCanvas
        className="h-full w-full"
        style={{ background: "var(--background)" }}
      >
        <TileLayer
          key={basemap}
          url={tile.url}
          attribution={tile.attr}
          maxZoom={tile.maxZoom}
          updateWhenIdle
          keepBuffer={2}
        />
        <ZoomControl position="topright" />
        <ScaleControl position="bottomleft" />
        <ViewportSync />
        <MousePos onMove={setMouse} />
        <ClickHandler />
        <MapRefCapture
          onReady={(m) => {
            mapRef.current = m;
          }}
        />

        <StudyAreaLayer />

        {layers.boundary && !studyArea && boundary.data && (
          <GeoJSON
            key="ng-boundary"
            data={boundary.data as GeoJSON.Geometry}
            style={{ color: "#2563eb", weight: 2, dashArray: "6 4", fillOpacity: 0 }}
          />
        )}

        <RoadsLayer onSelect={setSelected} />
        <HealthcareLayer onSelect={setSelected} />
        <EmergencyLayer onSelect={setSelected} />
        <SettlementsLayer />
        <TransportLayer />

        {emergencyPoint && (
          <>
            <Marker position={emergencyPoint} icon={ICONS.emergency}>
              <Popup>Emergency location</Popup>
            </Marker>
            <Circle
              center={emergencyPoint}
              radius={3000}
              pathOptions={{ color: "#ef4444", fillOpacity: 0.05 }}
            />
          </>
        )}

        {emergencyRoute && emergencyPoint && (
          <Polyline
            positions={[emergencyPoint, emergencyRoute.c] as L.LatLngExpression[]}
            pathOptions={{ color: "#ef4444", weight: 4, dashArray: "8 6" }}
          />
        )}

        <LocateOverlays />
      </MapContainer>

      {/* Overlay controls */}
      <div data-tour="locate" className="absolute top-3 left-3 z-[500] flex flex-col gap-2">
        <LocateMeButton />
        <FullscreenBtn containerRef={containerRef} />
        <BasemapGallery compact />
        <StudyAreaBadge />
      </div>

      {!studyArea && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[450] flex justify-center">
          <div className="animate-in fade-in slide-in-from-top-2 rounded-full border bg-background/90 px-4 py-1.5 text-xs shadow-lg backdrop-blur">
            Select a State and Local Government Area to load boundary and OpenStreetMap layers.
          </div>
        </div>
      )}

      <NearestFacilitiesPanel />
      <NavigationGuide />

      <LayerLoading />

      {/* Legend */}
      <div
        className={`absolute bottom-16 right-3 z-[400] rounded-lg border bg-background/85 backdrop-blur px-3 py-2 text-xs shadow-lg space-y-1`}
      >
        <div className="font-semibold mb-1">Legend</div>
        {layers.hospitals && <LegendRow color="#dc2626" label="Hospital" />}
        {layers.clinics && <LegendRow color="#2563eb" label="Clinic" />}
        {layers.pharmacies && <LegendRow color="#16a34a" label="Pharmacy" />}
        {layers.healthCentres && <LegendRow color="#7c3aed" label="Health centre" />}
        {layers.doctors && <LegendRow color="#0891b2" label="Doctors" />}
        {layers.emergency && <LegendRow color="#ea580c" label="Ambulance" />}
        {layers.settlements && <LegendRow color="#334155" label="Settlement" />}
        {layers.transport && <LegendRow color="#6b7280" label="Transport" />}
        {layers.roads && <LegendRow color="#ea580c" label="Major road" />}
        {layers.boundary && <LegendRow color="#2563eb" label="Boundary" />}
        {emergencyPoint && <LegendRow color="#ef4444" label="Incident / route" />}
      </div>

      <div className="absolute bottom-3 right-3 z-[400] rounded-md bg-background/85 backdrop-blur px-2 py-1 text-[11px] text-muted-foreground shadow">
        {mouse ? `${mouse[0].toFixed(4)}, ${mouse[1].toFixed(4)}` : "— , —"}
      </div>
    </div>
  );
}

function MousePos({ onMove }: { onMove: (ll: [number, number] | null) => void }) {
  useMapEvents({
    mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
    mouseout: () => onMove(null),
  });
  return null;
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-full border border-white shadow"
        style={{ background: color }}
      />
      <span>{label}</span>
    </div>
  );
}

// unused re-export guards
export type _LK = LayerKey;
