import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocateFixed, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { haversine } from "@/lib/oyo";
import { BAND_COLOR, type FacilityScore } from "@/lib/quality";
import { useStore } from "@/lib/store";

type Props = {
  scored: FacilityScore[];
  onSelect: (f: FacilityScore) => void;
};

const RADIUS_KM = 3;

/**
 * Locate the user and inspect the quality of nearby OSM healthcare data.
 * The position is shared through the global store, so "Locate me" here and on
 * the accessibility dashboard stay in sync.
 */
export default function NearbyQualityPanel({ scored, onSelect }: Props) {
  const user = useStore((s) => s.userLocation);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const [busy, setBusy] = useState(false);

  const pos = useMemo<[number, number] | null>(
    () => (user ? [user.lat, user.lng] : null),
    [user],
  );

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not available in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLocation({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setBusy(false);
        toast.success("Location found — inspecting nearby OSM data.");
      },
      (err) => {
        setBusy(false);
        toast.error(err.message || "Could not determine your location.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  // Allow the shared "locate me" event (used by guides) to drive this panel too.
  useEffect(() => {
    const handler = () => locate();
    window.addEventListener("opadbisrescue:locate-me", handler);
    return () => window.removeEventListener("opadbisrescue:locate-me", handler);
  });

  const nearby = useMemo(() => {
    if (!pos) return [];
    return scored
      .filter((f) => f.coords)
      .map((f) => ({ f, d: haversine(pos, f.coords!) }))
      .filter((x) => x.d <= RADIUS_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, 40);
  }, [pos, scored]);

  const summary = useMemo(() => {
    const s = { total: nearby.length, unnamed: 0, noPhone: 0, noHours: 0, disconnected: 0, avg: 0 };
    for (const { f } of nearby) {
      if (f.unnamed) s.unnamed++;
      const t = f.element.tags || {};
      if (!t.phone && !t["contact:phone"]) s.noPhone++;
      if (!t.opening_hours) s.noHours++;
      if (f.issues.some((i) => i.key === "connectivity")) s.disconnected++;
      s.avg += f.score;
    }
    s.avg = nearby.length ? Math.round(s.avg / nearby.length) : 0;
    return s;
  }, [nearby]);

  return (
    <div data-tour="q-locate" className="p-3 border-b space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LocateFixed className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Nearby data quality</div>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={locate} disabled={busy}>
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LocateFixed className="h-3 w-3" />
          )}
          {busy ? "Locating…" : "Locate me"}
        </Button>
      </div>

      {!pos ? (
        <div className="text-[11px] text-muted-foreground">
          Find your position and inspect the OpenStreetMap healthcare data within {RADIUS_KM} km —
          missing tags, duplicate candidates and road-connectivity problems you could fix on the
          spot.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Stat label="Facilities" value={summary.total} />
            <Stat label="Avg score" value={summary.avg} />
            <Stat label="Unnamed" value={summary.unnamed} warn={summary.unnamed > 0} />
            <Stat label="No phone" value={summary.noPhone} warn={summary.noPhone > 0} />
            <Stat label="No hours" value={summary.noHours} warn={summary.noHours > 0} />
            <Stat label="Off-road" value={summary.disconnected} warn={summary.disconnected > 0} />
          </div>
          <ScrollArea className="h-44 rounded border bg-background/60">
            <div className="divide-y">
              {nearby.map(({ f, d }) => (
                <button
                  key={`${f.element.type}/${f.element.id}`}
                  onClick={() => onSelect(f)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-accent/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate">{f.name}</span>
                    <Badge
                      className="shrink-0 text-[10px] px-1.5 py-0"
                      style={{ background: BAND_COLOR[f.band], color: "white" }}
                    >
                      {f.score}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <span>{(d * 1000).toFixed(0)} m away</span>
                    {f.missingTags.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {f.missingTags.length} missing tags
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {!nearby.length && (
                <div className="px-2.5 py-6 text-center text-[11px] text-muted-foreground">
                  No mapped healthcare facilities within {RADIUS_KM} km of your location — that is
                  itself a mapping gap worth filling.
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded border bg-background/60 px-1.5 py-1">
      <div className={`text-sm font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
