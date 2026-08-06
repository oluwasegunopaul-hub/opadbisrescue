import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState, useEffect, useRef } from "react";
import { useHealthcare, useRoads } from "@/hooks/useOverpass";
import {
  scoreAll,
  detectDuplicates,
  roadConnectivity,
  aggregate,
  BAND_COLOR,
  BAND_LABEL,
  osmUrl,
  idEditorUrl,
  josmRemoteUrl,
  type FacilityScore,
  type QualityBand,
} from "@/lib/quality";
import { exportCsv, exportGeoJson, exportIssuesJson, exportHtmlReport } from "@/lib/quality-export";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Copy,
  MapPin,
  Loader2,
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import BasemapGallery from "@/components/shared/BasemapGallery";
import AdminAreaSelector from "@/components/shared/AdminAreaSelector";
import QualityTour, { useFirstVisitTour } from "@/components/quality/QualityTour";
import NearbyQualityPanel from "@/components/quality/NearbyQualityPanel";
import { Maximize2, Minimize2, HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Cell,
  CartesianGrid,
} from "recharts";

const QualityMap = lazy(() => import("@/components/quality/QualityMap"));

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "OSM Data Quality — opadbisrescue" },
      {
        name: "description",
        content:
          "Continuously evaluate the quality and completeness of OpenStreetMap healthcare data across Nigeria. Detect missing tags, duplicates, connectivity gaps, and prioritise contributions.",
      },
      { property: "og:title", content: "OSM Data Quality — opadbisrescue" },
      {
        property: "og:description",
        content:
          "Healthcare data quality intelligence for OpenStreetMap contributors, NGOs and government agencies.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://healthaccess.lovable.app/opadbisrescue-og.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "OSM Data Quality — opadbisrescue" },
      {
        name: "twitter:description",
        content:
          "Healthcare data quality intelligence for OpenStreetMap contributors, NGOs and government agencies.",
      },
      { name: "twitter:image", content: "https://healthaccess.lovable.app/opadbisrescue-og.png" },
    ],
  }),
  component: QualityDashboard,
});

type BandFilter = "all" | QualityBand;

function QualityDashboard() {
  const hydrated = useHydrated();
  const healthcare = useHealthcare();
  const roads = useRoads();
  const [focus, setFocus] = useState<FacilityScore | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [bandFilter, setBandFilter] = useState<BandFilter>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const scored = useMemo(() => scoreAll(healthcare.data), [healthcare.data]);
  const duplicates = useMemo(() => detectDuplicates(scored), [scored]);
  useMemo(() => roadConnectivity(scored, roads.data ?? []), [scored, roads.data]);
  const agg = useMemo(() => {
    // recompute disconnected map after connectivity issues added
    const dis = new Map<string, number>();
    for (const f of scored) {
      if (f.issues.some((i) => i.key === "connectivity"))
        dis.set(`${f.element.type}/${f.element.id}`, 999);
    }
    return aggregate(scored, duplicates, dis);
  }, [scored, duplicates]);

  const filtered = useMemo(() => {
    return scored.filter((f) => {
      if (typeFilter !== "all" && f.facilityType !== typeFilter) return false;
      if (bandFilter !== "all" && f.band !== bandFilter) return false;
      if (issueFilter !== "all") {
        if (issueFilter === "unnamed" && !f.unnamed) return false;
        if (issueFilter === "phone" && (f.element.tags?.phone || f.element.tags?.["contact:phone"]))
          return false;
        if (issueFilter === "hours" && f.element.tags?.opening_hours) return false;
        if (issueFilter === "address" && f.addressCompleteness >= 50) return false;
        if (issueFilter === "connectivity" && !f.issues.some((i) => i.key === "connectivity"))
          return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${f.name} ${f.facilityType} ${Object.values(f.element.tags || {}).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scored, typeFilter, bandFilter, issueFilter, search]);

  const tour = useFirstVisitTour();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  const toggleFullscreen = async () => {
    const el = mapWrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFull(true);
    } else {
      await document.exitFullscreen?.();
      setFull(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <header
        data-tour="q-header"
        className="flex items-center justify-between border-b px-4 py-2 bg-card"
      >
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button size="icon" variant="ghost" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">OSM Data Quality Intelligence</h1>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Healthcare mapping quality assurance · Nigeria
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav data-tour="q-nav" className="flex items-center gap-1 text-xs">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" /> Accessibility
              </Button>
            </Link>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Data Quality
            </Button>
          </nav>
          <BasemapGallery />
          <Button data-tour="q-help" variant="ghost" size="sm" className="gap-1.5" onClick={() => tour.setOpen(true)}>
            <HelpCircle className="h-3.5 w-3.5" /> Guided tour
          </Button>
          <span data-tour="q-export">
            <ExportMenu scored={filtered} duplicates={duplicates} agg={agg} />
          </span>
        </div>
      </header>

      <div data-tour="q-kpi" data-tour-busy={healthcare.isFetching ? "1" : undefined}>
        <QualityKpiBar agg={agg} loading={healthcare.isFetching} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside
            data-tour="q-filters"
            className="w-72 border-r bg-card/40 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Study area
              </div>
              <AdminAreaSelector stacked />
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Filters
              </div>
              <Input
                placeholder="Search facilities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Facility type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facility types</SelectItem>
                  <SelectItem value="hospital">Hospitals</SelectItem>
                  <SelectItem value="clinic">Clinics</SelectItem>
                  <SelectItem value="pharmacy">Pharmacies</SelectItem>
                  <SelectItem value="health_centre">Health centres</SelectItem>
                  <SelectItem value="doctors">Doctors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bandFilter} onValueChange={(v) => setBandFilter(v as BandFilter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Quality band" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All quality bands</SelectItem>
                  <SelectItem value="excellent">Excellent (90-100)</SelectItem>
                  <SelectItem value="good">Good (75-89)</SelectItem>
                  <SelectItem value="needs">Needs Improvement (50-74)</SelectItem>
                  <SelectItem value="critical">Critical (&lt;50)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={issueFilter} onValueChange={setIssueFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All issues</SelectItem>
                  <SelectItem value="unnamed">Unnamed facilities</SelectItem>
                  <SelectItem value="phone">Missing phone</SelectItem>
                  <SelectItem value="hours">Missing opening hours</SelectItem>
                  <SelectItem value="address">Incomplete address</SelectItem>
                  <SelectItem value="connectivity">Disconnected from roads</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground pt-1">
                {filtered.length.toLocaleString()} of {scored.length.toLocaleString()} facilities
              </div>
            </div>
            <BandLegend />
          </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={mapWrapRef}
            data-tour="q-map"
            className="flex-1 relative min-h-[300px] bg-background"
          >
            {hydrated ? (
              <Suspense fallback={<MapLoading />}>
                <QualityMap scored={filtered} focus={focus} onSelect={setFocus} />
              </Suspense>
            ) : (
              <MapLoading />
            )}
            <div
              data-tour="q-mapctl"
              className="absolute top-3 right-16 z-[500] flex flex-col gap-2"
            >
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 shadow"
                onClick={toggleFullscreen}
                title="Fullscreen map"
                aria-label="Toggle fullscreen map"
              >
                {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <BasemapGallery compact />
            </div>
                  {healthcare.isFetching && (
              <div className="absolute top-3 left-3 z-[500] flex items-center gap-2 rounded-md bg-background/90 backdrop-blur px-3 py-1.5 text-xs border shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading OpenStreetMap data…
              </div>
            )}
            {!healthcare.isFetching && scored.length === 0 && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="bg-background/90 backdrop-blur border rounded-md px-4 py-3 text-xs text-muted-foreground text-center max-w-sm">
                  Zoom into a Nigerian state to load healthcare data. Overpass queries are gated by
                  zoom to stay responsive.
                </div>
              </div>
            )}
          </div>
          <div data-tour="q-tabs" className="flex flex-col overflow-hidden">
            <BottomTabs scored={filtered} agg={agg} duplicates={duplicates} onSelect={setFocus} />
          </div>
        </main>

        <aside className="w-96 border-l bg-card/40 flex flex-col overflow-hidden">
          <NearbyQualityPanel scored={scored} onSelect={setFocus} />
          <Separator />
          <FocusPanel focus={focus} />
        </aside>
      </div>

      <QualityTour open={tour.open} onClose={tour.close} onOpenChange={(v) => (v ? tour.setOpen(true) : tour.close())} />
    </div>
  );
}

function MapLoading() {
  return (
    <div className="grid h-full place-items-center text-muted-foreground text-sm">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
      </div>
    </div>
  );
}

function BandLegend() {
  const bands: QualityBand[] = ["excellent", "good", "needs", "critical"];
  return (
    <div className="p-3 text-xs space-y-1.5">
      <div className="font-semibold uppercase text-muted-foreground tracking-wider text-[10px]">
        Quality bands
      </div>
      {bands.map((b) => (
        <div key={b} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: BAND_COLOR[b] }}
          />
          <span>{BAND_LABEL[b]}</span>
        </div>
      ))}
    </div>
  );
}

function QualityKpiBar({ agg, loading }: { agg: ReturnType<typeof aggregate>; loading: boolean }) {
  const kpis = [
    { label: "Overall score", value: agg.overall, suffix: "/100", tone: agg.band },
    { label: "Facilities", value: agg.total, tone: "info" as const },
    { label: "Complete", value: agg.complete, tone: "good" as const },
    { label: "Incomplete", value: agg.incomplete, tone: "warn" as const },
    { label: "Unnamed", value: agg.unnamed, tone: "warn" as const },
    { label: "Missing phone", value: agg.missingPhone, tone: "warn" as const },
    { label: "Missing hours", value: agg.missingHours, tone: "warn" as const },
    { label: "Incomplete addr.", value: agg.missingAddress, tone: "warn" as const },
    { label: "Duplicate candidates", value: agg.duplicateCandidates, tone: "critical" as const },
    { label: "Disconnected", value: agg.disconnected, tone: "critical" as const },
  ];
  return (
    <div className="border-b bg-card/60 overflow-x-auto">
      <div className="flex divide-x min-w-max">
        {kpis.map((k, i) => (
          <div key={i} className="px-4 py-2 min-w-[112px]">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              {k.label}
            </div>
            <div className="text-lg font-semibold tabular-nums flex items-baseline gap-1">
              {loading && i === 0 ? "—" : k.value.toLocaleString()}
              {k.suffix && <span className="text-xs text-muted-foreground">{k.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomTabs({
  scored,
  agg,
  duplicates,
  onSelect,
}: {
  scored: FacilityScore[];
  agg: ReturnType<typeof aggregate>;
  duplicates: ReturnType<typeof detectDuplicates>;
  onSelect: (f: FacilityScore) => void;
}) {
  return (
    <div className="border-t bg-card h-72 overflow-hidden">
      <Tabs defaultValue="issues" className="h-full flex flex-col">
        <TabsList className="mx-3 mt-2 self-start">
          <TabsTrigger data-value="issues" value="issues">Issue explorer</TabsTrigger>
          <TabsTrigger data-value="unnamed" value="unnamed">Unnamed</TabsTrigger>
          <TabsTrigger data-value="duplicates" value="duplicates">Duplicates ({duplicates.length})</TabsTrigger>
          <TabsTrigger data-value="connectivity" value="connectivity">Connectivity</TabsTrigger>
          <TabsTrigger data-value="charts" value="charts">Analytics</TabsTrigger>
          <TabsTrigger data-value="guidance" value="guidance">Contribution guide</TabsTrigger>
        </TabsList>
        <TabsContent value="issues" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <IssueExplorer scored={scored} onSelect={onSelect} />
        </TabsContent>
        <TabsContent value="unnamed" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <UnnamedList scored={scored} onSelect={onSelect} />
        </TabsContent>
        <TabsContent value="duplicates" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <DuplicatePanel pairs={duplicates} onSelect={onSelect} />
        </TabsContent>
        <TabsContent value="connectivity" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <ConnectivityPanel scored={scored} onSelect={onSelect} />
        </TabsContent>
        <TabsContent value="charts" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <QualityCharts agg={agg} />
        </TabsContent>
        <TabsContent value="guidance" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 pb-3">
          <ContributionGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IssueExplorer({
  scored,
  onSelect,
}: {
  scored: FacilityScore[];
  onSelect: (f: FacilityScore) => void;
}) {
  const sorted = useMemo(
    () => [...scored].sort((a, b) => a.score - b.score).slice(0, 500),
    [scored],
  );
  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-left text-muted-foreground border-b">
            <th className="py-1.5 pr-3">Score</th>
            <th className="pr-3">Name</th>
            <th className="pr-3">Type</th>
            <th className="pr-3">Missing tags</th>
            <th className="pr-3">Address</th>
            <th className="pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => (
            <tr
              key={`${f.element.type}/${f.element.id}`}
              className="border-b hover:bg-muted/40 cursor-pointer"
              onClick={() => onSelect(f)}
            >
              <td className="py-1.5 pr-3">
                <Badge style={{ background: BAND_COLOR[f.band], color: "white" }}>{f.score}</Badge>
              </td>
              <td className="pr-3 max-w-[220px] truncate">{f.name}</td>
              <td className="pr-3 capitalize text-muted-foreground">
                {f.facilityType.replace("_", " ")}
              </td>
              <td className="pr-3 max-w-[280px] truncate">
                {f.missingTags.slice(0, 5).join(", ")}
              </td>
              <td className="pr-3">{f.addressCompleteness}%</td>
              <td className="pr-3">
                <ContributionActions f={f} compact />
              </td>
            </tr>
          ))}
          {!sorted.length && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                No facilities loaded. Zoom the map into Nigeria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function UnnamedList({
  scored,
  onSelect,
}: {
  scored: FacilityScore[];
  onSelect: (f: FacilityScore) => void;
}) {
  const unnamed = scored.filter((f) => f.unnamed);
  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {unnamed.map((f) => (
          <Card
            key={`${f.element.type}/${f.element.id}`}
            className="p-3 cursor-pointer hover:bg-muted/40"
            onClick={() => onSelect(f)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium capitalize">
                Unnamed {f.facilityType.replace("_", " ")}
              </span>
              <Badge style={{ background: BAND_COLOR[f.band], color: "white" }}>{f.score}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {f.coords ? `${f.coords[0].toFixed(4)}, ${f.coords[1].toFixed(4)}` : "no coordinates"}
            </div>
            <div className="mt-2">
              <ContributionActions f={f} compact />
            </div>
          </Card>
        ))}
        {!unnamed.length && (
          <div className="text-xs text-muted-foreground py-6 col-span-full text-center">
            No unnamed facilities in this view.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function DuplicatePanel({
  pairs,
  onSelect,
}: {
  pairs: ReturnType<typeof detectDuplicates>;
  onSelect: (f: FacilityScore) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={
                  p.confidence === "high"
                    ? "destructive"
                    : p.confidence === "medium"
                      ? "default"
                      : "secondary"
                }
              >
                {p.confidence} confidence
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {Math.round(p.distanceM)}m apart · {Math.round(p.nameSimilarity * 100)}% name match
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">{p.reason}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[p.a, p.b].map((f, k) => (
                <div
                  key={k}
                  className="border rounded-md p-2 cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelect(f)}
                >
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-muted-foreground capitalize">
                    {f.facilityType.replace("_", " ")} · score {f.score}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">
                    Operator: {f.element.tags?.operator || "—"}
                  </div>
                  <div className="mt-2">
                    <ContributionActions f={f} compact />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {!pairs.length && (
          <div className="text-xs text-muted-foreground py-6 text-center">
            No duplicate candidates detected in this view.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ConnectivityPanel({
  scored,
  onSelect,
}: {
  scored: FacilityScore[];
  onSelect: (f: FacilityScore) => void;
}) {
  const disc = scored.filter((f) => f.issues.some((i) => i.key === "connectivity"));
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {disc.map((f) => {
          const iss = f.issues.find((i) => i.key === "connectivity");
          return (
            <div
              key={`${f.element.type}/${f.element.id}`}
              className="border rounded-md p-2.5 flex items-center gap-3 text-xs cursor-pointer hover:bg-muted/40"
              onClick={() => onSelect(f)}
            >
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-muted-foreground">{iss?.label}</div>
              </div>
              <ContributionActions f={f} compact />
            </div>
          );
        })}
        {!disc.length && (
          <div className="text-xs text-muted-foreground py-6 text-center">
            Enable the Roads layer and zoom in to run connectivity analysis.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function QualityCharts({ agg }: { agg: ReturnType<typeof aggregate> }) {
  const byType = Object.entries(agg.byType).map(([k, v]) => ({
    name: k.replace("_", " "),
    score: v.avgScore,
    total: v.total,
  }));
  const topIssues = agg.topIssues.slice(0, 10);
  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
      <Card className="p-3 flex flex-col overflow-hidden">
        <div className="text-xs font-semibold mb-1">Average score by facility type</div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={10} tick={{ fill: "currentColor" }} />
              <YAxis domain={[0, 100]} fontSize={10} tick={{ fill: "currentColor" }} />
              <RTooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="score">
                {byType.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.score >= 90
                        ? BAND_COLOR.excellent
                        : d.score >= 75
                          ? BAND_COLOR.good
                          : d.score >= 50
                            ? BAND_COLOR.needs
                            : BAND_COLOR.critical
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-3 flex flex-col overflow-hidden">
        <div className="text-xs font-semibold mb-1">Top data quality issues</div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topIssues}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={10} tick={{ fill: "currentColor" }} />
              <YAxis
                type="category"
                dataKey="label"
                fontSize={10}
                width={180}
                tick={{ fill: "currentColor" }}
              />
              <RTooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ContributionGuide() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 text-sm max-w-3xl">
        <p>
          This dashboard identifies potential issues in OpenStreetMap healthcare data but never
          edits OSM directly. Human review is essential before publishing changes.
        </p>
        <div>
          <h3 className="font-semibold text-sm mb-1">Where to edit</h3>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>
              <a
                className="text-primary hover:underline"
                href="https://www.openstreetmap.org/edit?editor=id"
                target="_blank"
                rel="noopener"
              >
                iD Editor
              </a>{" "}
              — beginner friendly, in the browser.
            </li>
            <li>
              <a
                className="text-primary hover:underline"
                href="https://josm.openstreetmap.de/"
                target="_blank"
                rel="noopener"
              >
                JOSM
              </a>{" "}
              — desktop, remote-control links open features directly.
            </li>
            <li>
              Every issue in this dashboard has a "iD" or "JOSM" button — they preload the feature
              in your editor of choice.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1">Key healthcare tags</h3>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>
              <code>amenity=hospital / clinic / pharmacy / doctors</code> +{" "}
              <code>healthcare=hospital / clinic / pharmacy / doctor</code>
            </li>
            <li>
              <code>healthcare=centre</code> for primary health-care centres (PHC).
            </li>
            <li>
              <code>name, operator, phone, email, website, opening_hours</code>
            </li>
            <li>
              <code>
                addr:street, addr:housenumber, addr:city, addr:state, addr:postcode, addr:country
              </code>
            </li>
            <li>
              <code>wheelchair=yes/no/limited</code>, <code>emergency=yes/no</code>,{" "}
              <code>healthcare:speciality=*</code>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1">Reference</h3>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>
              <a
                className="text-primary hover:underline"
                href="https://wiki.openstreetmap.org/wiki/Key:healthcare"
                target="_blank"
                rel="noopener"
              >
                wiki.openstreetmap.org/wiki/Key:healthcare
              </a>
            </li>
            <li>
              <a
                className="text-primary hover:underline"
                href="https://wiki.openstreetmap.org/wiki/Nigeria"
                target="_blank"
                rel="noopener"
              >
                OSM Nigeria community wiki
              </a>
            </li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}

function FocusPanel({ focus }: { focus: FacilityScore | null }) {
  if (!focus) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-3.5 w-3.5" /> Feature detail
        </div>
        Click any marker or row to inspect its quality breakdown.
      </div>
    );
  }
  const b = focus.breakdown;
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{focus.name}</div>
            <div className="text-[11px] text-muted-foreground capitalize">
              {focus.facilityType.replace("_", " ")}
            </div>
          </div>
          <Badge style={{ background: BAND_COLOR[focus.band], color: "white" }}>
            {focus.score} · {BAND_LABEL[focus.band]}
          </Badge>
        </div>

        <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
          {(["attributes", "contact", "address", "consistency", "geometry"] as const).map((k) => (
            <div key={k} className="rounded border p-1.5">
              <div className="font-semibold text-sm">{b[k]}</div>
              <div className="text-muted-foreground capitalize">{k}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Issues ({focus.issues.length})
          </div>
          <ul className="space-y-1.5 text-xs">
            {focus.issues.map((i, k) => (
              <li key={k} className="border rounded-md p-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${i.severity === "critical" ? "bg-destructive" : i.severity === "warn" ? "bg-orange-500" : "bg-blue-500"}`}
                  />
                  <span className="font-medium">{i.label}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">{i.suggestion}</div>
                {i.osmTags && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.osmTags.map((t) => (
                      <code key={t} className="text-[10px] bg-muted px-1 rounded">
                        {t}
                      </code>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <ContributionActions f={focus} />
      </div>
    </ScrollArea>
  );
}

function ContributionActions({ f, compact }: { f: FacilityScore; compact?: boolean }) {
  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${f.element.type}/${f.element.id}`);
    toast.success("Feature ID copied");
  };
  const open = (url: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const josm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(josmRemoteUrl(f.element), { mode: "no-cors" });
      toast.success("Sent to JOSM (ensure remote control is enabled)");
    } catch {
      toast.error("Could not reach JOSM remote control on 127.0.0.1:8111");
    }
  };
  if (compact) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Open in OSM"
          onClick={open(osmUrl(f.element))}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" title="Copy ID" onClick={copyId}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1.5"
        onClick={open(osmUrl(f.element))}
      >
        <ExternalLink className="h-3 w-3" /> OSM
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={open(idEditorUrl(f.element))}
      >
        iD Editor
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={josm}>
        JOSM
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={copyId}>
        <Copy className="h-3 w-3" /> Copy ID
      </Button>
    </div>
  );
}

function ExportMenu({
  scored,
  duplicates,
  agg,
}: {
  scored: FacilityScore[];
  duplicates: ReturnType<typeof detectDuplicates>;
  agg: ReturnType<typeof aggregate>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={scored.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCsv(scored)}>CSV (filtered)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportGeoJson(scored)}>
          GeoJSON (filtered)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportIssuesJson(scored, duplicates, agg)}>
          Full JSON report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportHtmlReport(agg, scored, duplicates)}>
          HTML quality report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
