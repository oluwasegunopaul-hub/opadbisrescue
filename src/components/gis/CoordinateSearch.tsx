import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { findNearestFacilities, facilityName } from "@/lib/nearest";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Hospital, Stethoscope, Pill, Ambulance } from "lucide-react";
import type { NearestCategory, NearestHit } from "@/lib/store";

const ROWS: {
  key: NearestCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "hospital", label: "Hospital", icon: Hospital },
  { key: "clinic", label: "Clinic", icon: Stethoscope },
  { key: "pharmacy", label: "Pharmacy", icon: Pill },
  { key: "ambulance", label: "Ambulance station", icon: Ambulance },
];

function parseCoords(raw: string): [number, number] | null {
  const parts = raw
    .replace(/[°]/g, " ")
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lng] = parts as [number, number];
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Manual coordinate entry for emergency response — finds the nearest facilities via Overpass. */
export default function CoordinateSearch() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Partial<Record<NearestCategory, NearestHit>> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setEmergencyPoint = useStore((s) => s.setEmergencyPoint);
  const setSelected = useStore((s) => s.setSelected);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCoords(value);
    if (!parsed) {
      setError("Enter coordinates as latitude, longitude (e.g. 7.3775, 3.9470).");
      return;
    }
    setError(null);
    setResults(null);
    setEmergencyPoint(parsed);
    window.dispatchEvent(new CustomEvent("opadbisrescue:goto", { detail: parsed }));

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const { results: found } = await findNearestFacilities(parsed[0], parsed[1], ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults(found);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Unable to search facilities near those coordinates. Please try again.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="coord-input" className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Enter coordinates
      </Label>
      <div className="flex gap-1.5">
        <Input
          id="coord-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="7.3775, 3.9470"
          maxLength={60}
          className="h-8 text-xs"
          inputMode="decimal"
        />
        <Button type="submit" size="sm" className="h-8 px-2" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {loading && <p className="text-[11px] text-muted-foreground">Searching OpenStreetMap…</p>}

      {results && (
        <div className="space-y-1 pt-1">
          {ROWS.map(({ key, label, icon: Icon }) => {
            const hit = results[key];
            return (
              <button
                key={key}
                type="button"
                disabled={!hit}
                onClick={() => hit && setSelected(hit.element)}
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] disabled:opacity-50 hover:bg-accent"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">
                  <span className="text-muted-foreground">{label}: </span>
                  {hit ? facilityName(hit.element) : "None found within 50 km"}
                </span>
                {hit && <span className="font-medium">{formatDistance(hit.distanceKm)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </form>
  );
}
