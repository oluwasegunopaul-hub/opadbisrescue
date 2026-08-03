import { useEffect, useRef, useState } from "react";
import { useStore, type NearestCategory, type NearestHit } from "@/lib/store";
import {
  findNearestFacilities,
  fetchOsrmRoute,
  facilityName,
  type RouteMode,
} from "@/lib/nearest";
import { Button } from "@/components/ui/button";
import {
  Crosshair,
  Loader2,
  X,
  Navigation,
  Hospital,
  Stethoscope,
  Pill,
  Ambulance,
  AlertTriangle,
  CheckCircle2,
  Car,
  Footprints,
} from "lucide-react";

const META: Record<
  NearestCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  hospital: { label: "Nearest Hospital", icon: Hospital, color: "text-red-600" },
  clinic: { label: "Nearest Clinic", icon: Stethoscope, color: "text-emerald-600" },
  pharmacy: { label: "Nearest Pharmacy", icon: Pill, color: "text-blue-600" },
  ambulance: { label: "Nearest Ambulance", icon: Ambulance, color: "text-orange-600" },
};

function estMinutes(km: number, mode: RouteMode) {
  const speed = mode === "walking" ? 5 : 45; // km/h fallback
  return Math.max(1, Math.round((km / speed) * 60));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function LocateMeButton() {
  const abortRef = useRef<AbortController | null>(null);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const setNearest = useStore((s) => s.setNearest);
  const setNearestLoading = useStore((s) => s.setNearestLoading);
  const setNearestError = useStore((s) => s.setNearestError);
  const setPanelOpen = useStore((s) => s.setPanelOpen);
  const setActiveRoute = useStore((s) => s.setActiveRoute);
  const loading = useStore((s) => s.nearestLoading);

  const run = () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setNearestError(null);
    setActiveRoute(null);
    setNearest(null);
    setPanelOpen(true);
    setNearestLoading(true);

    if (!navigator.geolocation) {
      setNearestError("Geolocation is not supported by this browser.");
      setNearestLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        try {
          const { results } = await findNearestFacilities(latitude, longitude, ctrl.signal);
          if (ctrl.signal.aborted) return;
          setNearest(results);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setNearestError(
            "Unable to retrieve nearby healthcare facilities. Please try again later.",
          );
        } finally {
          if (!ctrl.signal.aborted) setNearestLoading(false);
        }
      },
      (err) => {
        setNearestLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setNearestError(
            "Location access is required to locate nearby emergency healthcare facilities.",
          );
        } else {
          setNearestError("Unable to determine your current location.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  useEffect(() => {
    const handler = () => run();
    window.addEventListener("opadbisrescue:locate-me", handler);
    return () => window.removeEventListener("opadbisrescue:locate-me", handler);
  });

  return (
    <Button
      size="icon"
      variant="secondary"
      className="shadow-lg h-11 w-11 rounded-full"
      onClick={run}
      disabled={loading}
      title="Locate Me"
      aria-label="Locate Me"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Crosshair className="h-5 w-5" />
      )}
    </Button>
  );
}

export function NearestFacilitiesPanel() {
  const open = useStore((s) => s.panelOpen);
  const setOpen = useStore((s) => s.setPanelOpen);
  const loading = useStore((s) => s.nearestLoading);
  const error = useStore((s) => s.nearestError);
  const nearest = useStore((s) => s.nearest);
  const user = useStore((s) => s.userLocation);
  const activeRoute = useStore((s) => s.activeRoute);
  const setActiveRoute = useStore((s) => s.setActiveRoute);
  const setSelected = useStore((s) => s.setSelected);
  const [routeMode, setRouteMode] = useState<RouteMode>("driving");
  const [routingKey, setRoutingKey] = useState<NearestCategory | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => routeAbortRef.current?.abort(), []);

  if (!open) return null;

  const cats: NearestCategory[] = ["hospital", "clinic", "pharmacy", "ambulance"];

  const navigateTo = async (hit: NearestHit) => {
    if (!user) return;
    routeAbortRef.current?.abort();
    const ctrl = new AbortController();
    routeAbortRef.current = ctrl;
    setRoutingKey(hit.category);
    setSelected(hit.element);
    try {
      const r = await fetchOsrmRoute(
        [user.lat, user.lng],
        hit.coords,
        routeMode,
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      setActiveRoute({ ...r, destination: hit, steps: r.steps });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // Fallback: straight line
      setActiveRoute({
        coords: [[user.lat, user.lng], hit.coords],
        distanceKm: hit.distanceKm,
        durationMin: estMinutes(hit.distanceKm, routeMode),
        destination: hit,
        steps: [],
      });
    } finally {
      if (!ctrl.signal.aborted) setRoutingKey(null);
    }
  };

  const hospital = nearest?.hospital;
  const recommendation = hospital
    ? hospital.distanceKm < 5
      ? {
          tone: "ok" as const,
          text: "Nearest hospital is within quick emergency reach.",
        }
      : hospital.distanceKm > 15
        ? {
            tone: "warn" as const,
            text: "Warning: Your location has limited emergency healthcare accessibility.",
          }
        : null
    : nearest && !loading
      ? {
          tone: "warn" as const,
          text: "No nearby hospital was found in the current OpenStreetMap dataset.",
        }
      : null;

  return (
    <div
      data-tour="nearest-panel"
      className="absolute top-3 right-3 z-[500] w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 dark:border-white/10 bg-background/85 backdrop-blur-xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-label="Nearest emergency facilities"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
        <div>
          <div className="text-sm font-semibold">Nearest Emergency Facilities</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Powered by OpenStreetMap
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Mode</span>
        <div className="ml-auto inline-flex rounded-md border overflow-hidden">
          <button
            onClick={() => setRouteMode("driving")}
            className={`px-2 py-1 flex items-center gap-1 ${routeMode === "driving" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
          >
            <Car className="h-3 w-3" /> Drive
          </button>
          <button
            onClick={() => setRouteMode("walking")}
            className={`px-2 py-1 flex items-center gap-1 ${routeMode === "walking" ? "bg-primary text-primary-foreground" : "bg-transparent"}`}
          >
            <Footprints className="h-3 w-3" /> Walk
          </button>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-6 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Finding nearby healthcare facilities…
        </div>
      )}

      {error && (
        <div className="px-4 py-4 text-sm">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && nearest && (
        <>
          {recommendation && (
            <div
              className={`px-4 py-2 text-xs flex items-start gap-2 ${
                recommendation.tone === "ok"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {recommendation.tone === "ok" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{recommendation.text}</span>
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto divide-y divide-border/50">
            {cats.map((cat) => {
              const hit = nearest[cat];
              const M = META[cat];
              const Icon = M.icon;
              if (!hit) {
                return (
                  <div key={cat} className="px-4 py-3 flex items-center gap-3 opacity-60">
                    <Icon className={`h-5 w-5 ${M.color}`} />
                    <div className="flex-1 text-xs">
                      <div className="font-medium">{M.label}</div>
                      <div className="text-muted-foreground">Not found nearby</div>
                    </div>
                  </div>
                );
              }
              const mins = estMinutes(hit.distanceKm, routeMode);
              const isActive = activeRoute?.destination.category === cat;
              return (
                <div key={cat} className="px-4 py-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${M.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {M.label}
                      </div>
                      <div className="text-sm font-semibold truncate">
                        {facilityName(hit.element)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{formatDistance(hit.distanceKm)}</span>
                        <span>•</span>
                        <span>~{mins} min {routeMode === "walking" ? "walk" : "drive"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => navigateTo(hit)}
                      disabled={routingKey === cat}
                    >
                      {routingKey === cat ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Navigation className="h-3 w-3 mr-1" />
                      )}
                      {isActive ? "Route active" : "Navigate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setSelected(hit.element)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {activeRoute && (
            <div className="px-4 py-3 border-t border-border/50 bg-primary/5 text-xs">
              <div className="font-medium mb-1">Active route</div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{formatDistance(activeRoute.distanceKm)}</span>
                <span>•</span>
                <span>~{Math.round(activeRoute.durationMin)} min</span>
                <button
                  className="ml-auto text-destructive hover:underline"
                  onClick={() => setActiveRoute(null)}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
