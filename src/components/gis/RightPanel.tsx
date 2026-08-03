import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useHealthcare, useEmergency, classifyFacility, classifyEmergency } from "@/hooks/useOverpass";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { elementCoords, haversine } from "@/lib/oyo";
import { Button } from "@/components/ui/button";
import { Download, MapPin, X } from "lucide-react";
import CoordinateSearch from "@/components/gis/CoordinateSearch";

const BASEMAPS = [
  { k: "osm", label: "OSM Standard" },
  { k: "hot", label: "OSM Humanitarian" },
  { k: "carto-light", label: "Carto Light" },
  { k: "carto-dark", label: "Carto Dark" },
];

const LAYER_TOGGLES: { key: keyof ReturnType<typeof useStore.getState>["layers"]; label: string }[] = [
  { key: "hospitals", label: "Hospitals" },
  { key: "clinics", label: "Clinics" },
  { key: "pharmacies", label: "Pharmacies" },
  { key: "healthCentres", label: "Health centres" },
  { key: "doctors", label: "Doctors" },
  { key: "emergency", label: "Emergency" },
  { key: "settlements", label: "Settlements" },
  { key: "transport", label: "Transport" },
  { key: "roads", label: "Major roads" },
  { key: "boundary", label: "State boundary" },
];

const COLORS = ["#dc2626", "#2563eb", "#16a34a", "#7c3aed", "#0891b2", "#ea580c"];

export default function RightPanel() {
  const nav = useStore((s) => s.nav);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const emergencyPoint = useStore((s) => s.emergencyPoint);
  const setEmergencyPoint = useStore((s) => s.setEmergencyPoint);
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const facilityFilter = useStore((s) => s.facilityFilter);
  const setFacilityFilter = useStore((s) => s.setFacilityFilter);

  const healthcare = useHealthcare();
  const emergency = useEmergency();

  const facilityCounts = useMemo(() => {
    const map = new Map<string, number>();
    (healthcare.data || []).forEach((el) => {
      const k = classifyFacility(el);
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [healthcare.data]);

  const emergencyCounts = useMemo(() => {
    const map = new Map<string, number>();
    (emergency.data || []).forEach((el) => {
      const k = classifyEmergency(el);
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [emergency.data]);

  const nearest = useMemo(() => {
    if (!emergencyPoint || !healthcare.data) return null;
    const items = healthcare.data
      .map((el) => {
        const c = elementCoords(el);
        if (!c) return null;
        return { el, kind: classifyFacility(el), d: haversine(emergencyPoint, c) };
      })
      .filter(Boolean) as { el: import("@/lib/oyo").OverpassElement; kind: string; d: number }[];
    const byKind = (k: string) =>
      items.filter((i) => i.kind === k).sort((a, b) => a.d - b.d)[0];
    const nearestAmbulance = (emergency.data || [])
      .map((el) => {
        const c = elementCoords(el);
        if (!c || classifyEmergency(el) !== "ambulance") return null;
        return { el, d: haversine(emergencyPoint, c) };
      })
      .filter(Boolean)
      .sort((a, b) => a!.d - b!.d)[0] as { el: import("@/lib/oyo").OverpassElement; d: number } | undefined;
    return {
      hospital: byKind("hospital"),
      clinic: byKind("clinic"),
      pharmacy: byKind("pharmacy"),
      ambulance: nearestAmbulance,
    };
  }, [emergencyPoint, healthcare.data, emergency.data]);

  const exportCSV = () => {
    const rows = [
      ["type", "name", "lat", "lon", "operator", "phone"],
      ...(healthcare.data || []).map((el) => {
        const c = elementCoords(el);
        return [
          classifyFacility(el),
          el.tags?.name || "",
          c?.[0] ?? "",
          c?.[1] ?? "",
          el.tags?.operator || "",
          el.tags?.phone || "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oyo-healthcare.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGeoJSON = () => {
    const features = (healthcare.data || [])
      .map((el) => {
        const c = elementCoords(el);
        if (!c) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c[1], c[0]] },
          properties: { kind: classifyFacility(el), ...(el.tags || {}) },
        };
      })
      .filter(Boolean);
    const gj = { type: "FeatureCollection", features };
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oyo-healthcare.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside data-tour="right-panel" className="flex h-full w-[340px] shrink-0 flex-col border-l bg-card overflow-hidden">
      <div className="p-3 border-b space-y-2">
        <Input
          data-tour="search"
          placeholder="Search hospitals, clinics, villages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div data-tour="filter" className="grid grid-cols-2 gap-2">
          <Select value={facilityFilter} onValueChange={setFacilityFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Facility" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              <SelectItem value="hospital">Hospitals</SelectItem>
              <SelectItem value="clinic">Clinics</SelectItem>
              <SelectItem value="pharmacy">Pharmacies</SelectItem>
              <SelectItem value="health_centre">Health centres</SelectItem>
              <SelectItem value="doctors">Doctors</SelectItem>
            </SelectContent>
          </Select>
          <Select value={basemap} onValueChange={(v) => setBasemap(v as never)}>
            <SelectTrigger data-tour="basemap-select" className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BASEMAPS.map((b) => (
                <SelectItem key={b.k} value={b.k}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {nav === "emergency" && (
          <Card className="border-red-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" /> Emergency response
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <CoordinateSearch />
              <div className="h-px bg-border" />
              {!emergencyPoint ? (
                <p className="text-muted-foreground">
                  Or click anywhere on the map to locate the nearest hospital, clinic, pharmacy and ambulance station.
                </p>
              ) : (
                <>
                  <div className="text-muted-foreground">
                    Incident: {emergencyPoint[0].toFixed(4)}, {emergencyPoint[1].toFixed(4)}
                  </div>
                  <NearestRow label="Hospital" item={nearest?.hospital} />
                  <NearestRow label="Clinic" item={nearest?.clinic} />
                  <NearestRow label="Pharmacy" item={nearest?.pharmacy} />
                  <NearestRow label="Ambulance" item={nearest?.ambulance ? { ...nearest.ambulance, kind: "ambulance" } : undefined} />
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setEmergencyPoint(null)}>
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {selected && (
          <Card data-tour="selected-feature">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Selected feature</CardTitle>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div className="font-semibold text-sm">{selected.tags?.name || "Unnamed"}</div>
              <Badge variant="secondary" className="capitalize">
                {selected.tags?.amenity || selected.tags?.healthcare || selected.tags?.highway || "feature"}
              </Badge>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-2">
                {Object.entries(selected.tags || {}).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="contents">
                    <span className="text-muted-foreground truncate">{k}</span>
                    <span className="truncate">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-tour="analytics">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Healthcare mix</CardTitle></CardHeader>
          <CardContent className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={facilityCounts} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65}>
                  {facilityCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-tour="emergency-chart">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Emergency infrastructure</CardTitle></CardHeader>
          <CardContent className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emergencyCounts}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#ea580c" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-tour="layers">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Layers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {LAYER_TOGGLES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`ly-${key}`} className="text-xs font-normal">{label}</Label>
                <Switch id={`ly-${key}`} checked={layers[key]} onCheckedChange={() => toggleLayer(key)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-tour="export">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Export</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportGeoJSON}>
              <Download className="h-3 w-3 mr-1" /> GeoJSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

function NearestRow({
  label,
  item,
}: {
  label: string;
  item?: { el: import("@/lib/oyo").OverpassElement; d: number; kind?: string };
}) {
  if (!item) return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span><span>—</span>
    </div>
  );
  return (
    <div className="flex justify-between gap-2 border-t pt-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <div className="font-medium truncate max-w-[180px]">{item.el.tags?.name || "Unnamed"}</div>
        <div className="text-[10px] text-muted-foreground">
          {item.d.toFixed(1)} km · ~{Math.round((item.d / 40) * 60)} min drive
        </div>
      </span>
    </div>
  );
}
