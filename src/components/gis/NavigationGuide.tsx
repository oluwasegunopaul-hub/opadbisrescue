import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchOsrmRoute, facilityName, type RouteMode, type RoutePreference } from "@/lib/nearest";
import { haversine } from "@/lib/oyo";
import { Button } from "@/components/ui/button";
import {
  Navigation,
  Play,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Car,
  Footprints,
  Bike,
  Ambulance,
  Clock,
  Gauge,
  MapPin,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowRight,
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  RotateCw,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Phone,
  Accessibility,
} from "lucide-react";

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function fmtMin(min: number) {
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}
function fmtEta(min: number) {
  const d = new Date(Date.now() + min * 60000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StepIcon({ type, modifier, className }: { type: string; modifier?: string; className?: string }) {
  const cls = className ?? "h-5 w-5";
  if (type === "arrive") return <Flag className={cls} />;
  if (type === "roundabout" || type === "rotary") return <RotateCw className={cls} />;
  if (type === "turn" || type === "end of road") {
    if (modifier?.includes("sharp left")) return <CornerUpLeft className={cls} />;
    if (modifier?.includes("sharp right")) return <CornerUpRight className={cls} />;
    if (modifier === "left" || modifier === "slight left") return <ArrowLeft className={cls} />;
    if (modifier === "right" || modifier === "slight right") return <ArrowRight className={cls} />;
    if (modifier === "uturn") return <RotateCcw className={cls} />;
  }
  if (modifier === "slight left") return <ArrowUpLeft className={cls} />;
  if (modifier === "slight right") return <ArrowUpRight className={cls} />;
  return <ArrowUp className={cls} />;
}

function speak(text: string, muted: boolean, volume: number) {
  if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.volume = Math.max(0, Math.min(1, volume));
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export default function NavigationGuide() {
  const open = useStore((s) => s.navGuideOpen);
  const setOpen = useStore((s) => s.setNavGuideOpen);
  const user = useStore((s) => s.userLocation);
  const setUser = useStore((s) => s.setUserLocation);
  const route = useStore((s) => s.activeRoute);
  const setRoute = useStore((s) => s.setActiveRoute);
  const setPanelOpen = useStore((s) => s.setPanelOpen);

  const [mode, setMode] = useState<RouteMode>("driving");
  const [preference, setPreference] = useState<RoutePreference>("fastest");
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [remainingMin, setRemainingMin] = useState<number | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string>("");

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const spokenStepsRef = useRef<Set<number>>(new Set());

  const dest = route?.destination;
  const steps = route?.steps ?? [];

  // Auto-close on unmount / clear route
  useEffect(() => {
    if (!route && navigating) {
      stopNavigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      abortRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const recomputeRoute = async (from: [number, number]) => {
    if (!dest) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRecomputing(true);
    try {
      const r = await fetchOsrmRoute(from, dest.coords, mode, ctrl.signal, {
        alternatives: false,
        preference,
      });
      if (ctrl.signal.aborted) return;
      setRoute({
        coords: r.coords,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
        destination: dest,
        steps: r.steps,
      });
      setCurrentStep(0);
      spokenStepsRef.current.clear();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Route calculation failed. Please try again.");
      }
    } finally {
      if (!ctrl.signal.aborted) setRecomputing(false);
    }
  };

  const startNavigation = async () => {
    if (!user || !dest) return;
    setError(null);
    setArrived(false);
    // Ensure fresh route with steps in current mode/preference
    await recomputeRoute([user.lat, user.lng]);
    setNavigating(true);
    speak("Navigation started.", muted, volume);
    setLastInstruction("Navigation started.");

    if (!navigator.geolocation) return;
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed } = pos.coords;
        const now = Date.now();
        // Compute speed from delta if geolocation speed is unavailable
        let kmh: number | null = speed != null ? (speed * 3.6) : null;
        if (kmh == null && lastPosRef.current) {
          const dKm = haversine(
            [lastPosRef.current.lat, lastPosRef.current.lng],
            [latitude, longitude],
          );
          const dtH = (now - lastPosRef.current.t) / 3600000;
          if (dtH > 0) kmh = dKm / dtH;
        }
        lastPosRef.current = { lat: latitude, lng: longitude, t: now };
        setSpeedKmh(kmh);
        setUser({ lat: latitude, lng: longitude, accuracy });
      },
      () => {
        /* ignore transient errors */
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  };

  const stopNavigation = () => {
    setNavigating(false);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Progress: distance remaining along route + current step + arrival detection
  useEffect(() => {
    if (!navigating || !user || !route || steps.length === 0) return;
    const userLL: [number, number] = [user.lat, user.lng];
    // Find closest step index (skip past ones we've moved beyond)
    let bestIdx = currentStep;
    let bestDist = Infinity;
    for (let i = currentStep; i < steps.length; i++) {
      const d = haversine(userLL, steps[i].location);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx !== currentStep) setCurrentStep(bestIdx);

    // Remaining distance = sum from bestIdx onward + haversine from user to next maneuver
    let rem = 0;
    for (let i = bestIdx; i < steps.length; i++) rem += steps[i].distanceM;
    const remKm = rem / 1000 + bestDist;
    setRemainingKm(remKm);
    const avg = mode === "walking" ? 5 : mode === "cycling" ? 15 : 40;
    setRemainingMin((remKm / avg) * 60);

    // Voice: announce upcoming step when close
    const upcoming = steps[bestIdx];
    if (upcoming && !spokenStepsRef.current.has(bestIdx)) {
      const distToStep = haversine(userLL, upcoming.location) * 1000;
      if (distToStep < 250) {
        spokenStepsRef.current.add(bestIdx);
        const text =
          upcoming.type === "arrive"
            ? "You have arrived at your destination."
            : `In ${fmtDist(distToStep)}, ${upcoming.instruction}.`;
        speak(text, muted, volume);
        setLastInstruction(text);
      }
    }

    // Arrival check
    const distToDest = haversine(userLL, dest!.coords) * 1000;
    if (distToDest < 30 && !arrived) {
      setArrived(true);
      stopNavigation();
      speak("You have arrived at your destination.", muted, volume);
      setLastInstruction("You have arrived at your destination.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigating, route]);

  // Auto-open when a route is set externally
  useEffect(() => {
    if (route && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const emergencyStart = () => {
    setEmergencyMode(true);
    // Ask NearestPanel logic to run: locate + find nearest, then navigate to nearest hospital
    setPanelOpen(true);
    window.dispatchEvent(new CustomEvent("opadbisrescue:locate-me"));
    // The user then clicks Navigate in the panel; we could auto-navigate on results.
    window.dispatchEvent(new CustomEvent("opadbisrescue:emergency-navigate"));
  };

  const routeDifficulty = useMemo(() => {
    if (!route) return "—";
    if (route.distanceKm < 3) return "Easy";
    if (route.distanceKm < 15) return "Moderate";
    return "Long";
  }, [route]);

  const turnsCount = steps.filter((s) => s.type === "turn").length;
  const progressPct = route && remainingKm != null
    ? Math.max(0, Math.min(100, Math.round((1 - remainingKm / route.distanceKm) * 100)))
    : 0;

  if (!open || !dest || !route) return null;

  const facility = dest.element;
  const tags = facility.tags || {};
  const currentRoad = steps[currentStep]?.name || "—";
  const nextStep = steps[Math.min(currentStep + 1, steps.length - 1)];

  return (
    <div
      data-tour="navigation-guide"
      className="absolute top-3 right-3 z-[600] w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-white/20 dark:border-white/10 bg-background/85 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4"
      role="dialog"
      aria-label="Navigation guide"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-border/50 ${emergencyMode ? "bg-red-500/10" : "bg-gradient-to-r from-primary/10 to-transparent"}`}>
        <div className="flex items-center gap-2 min-w-0">
          {emergencyMode ? (
            <Ambulance className="h-5 w-5 text-red-600 animate-pulse" />
          ) : (
            <Navigation className="h-5 w-5 text-primary" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{facilityName(facility)}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest capitalize">
              {dest.category} · {routeDifficulty} route
            </div>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { stopNavigation(); setOpen(false); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Arrival banner */}
        {arrived && (
          <div className="px-4 py-4 bg-emerald-500/10 border-b border-emerald-500/20 text-center animate-in zoom-in">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✅ Destination Reached
            </div>
            <div className="text-xs text-muted-foreground">Welcome to</div>
            <div className="text-sm font-medium">{facilityName(facility)}</div>
            <div className="mt-3 flex gap-2 justify-center">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Return to Dashboard
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setArrived(false);
                  setRoute(null);
                  setOpen(false);
                  setPanelOpen(true);
                }}
              >
                Find Another
              </Button>
            </div>
          </div>
        )}

        {/* Trip summary */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border/50 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Distance</div>
            <div className="text-sm font-semibold">
              {fmtDist((remainingKm ?? route.distanceKm) * 1000)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">ETA</div>
            <div className="text-sm font-semibold">{fmtEta(remainingMin ?? route.durationMin)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Time</div>
            <div className="text-sm font-semibold">{fmtMin(remainingMin ?? route.durationMin)}</div>
          </div>
        </div>

        {/* Progress bar */}
        {navigating && (
          <div className="px-4 py-2 border-b border-border/50">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Live progress card */}
        {navigating && (
          <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-border/50 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Speed</span>
              <span className="ml-auto font-medium">
                {speedKmh != null ? `${Math.round(speedKmh)} km/h` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Turns</span>
              <span className="ml-auto font-medium">{turnsCount}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">On</span>
              <span className="ml-auto font-medium truncate max-w-[60%]">{currentRoad || "Unnamed road"}</span>
            </div>
          </div>
        )}

        {/* Mode + preference */}
        {!navigating && !arrived && (
          <div className="px-4 py-3 border-b border-border/50 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Transport mode
            </div>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {[
                { k: "driving", icon: Car, label: "Drive" },
                { k: "walking", icon: Footprints, label: "Walk" },
                { k: "cycling", icon: Bike, label: "Bike" },
                { k: "driving", icon: Ambulance, label: "EMS" },
              ].map(({ k, icon: I, label }, i) => (
                <button
                  key={i}
                  onClick={() => setMode(k as RouteMode)}
                  className={`px-2 py-1.5 rounded-md border flex flex-col items-center gap-0.5 transition ${
                    mode === k && (label !== "EMS" || emergencyMode)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <I className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-1">
              Route options
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {(["fastest", "shortest"] as RoutePreference[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreference(p)}
                  className={`px-2 py-1.5 rounded-md border capitalize transition ${
                    preference === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current + upcoming step */}
        {navigating && steps[currentStep] && !arrived && (
          <div className="px-4 py-4 border-b border-border/50 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <StepIcon
                  type={steps[currentStep].type}
                  modifier={steps[currentStep].modifier}
                  className="h-6 w-6 text-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{steps[currentStep].instruction}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtDist(steps[currentStep].distanceM)} · {steps[currentStep].name || "Unnamed road"}
                </div>
              </div>
            </div>
            {nextStep && nextStep !== steps[currentStep] && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Then</span>
                <StepIcon type={nextStep.type} modifier={nextStep.modifier} className="h-3.5 w-3.5" />
                <span className="truncate">{nextStep.instruction}</span>
              </div>
            )}
          </div>
        )}

        {/* All steps */}
        {steps.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Turn-by-turn ({steps.length})
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-[11px] rounded-md px-2 py-1.5 ${
                    i === currentStep ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                  }`}
                >
                  <StepIcon type={s.type} modifier={s.modifier} className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.instruction}</div>
                    <div className="text-muted-foreground">{fmtDist(s.distanceM)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destination info */}
        <div className="px-4 py-3 border-b border-border/50 space-y-1 text-[11px]">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Destination info
          </div>
          <InfoRow label="Emergency" value={tags.emergency || "—"} />
          <InfoRow
            label="Phone"
            value={tags.phone || tags["contact:phone"] || "—"}
            icon={<Phone className="h-3 w-3" />}
          />
          <InfoRow label="Hours" value={tags.opening_hours || "—"} />
          <InfoRow label="Address" value={tags["addr:street"] || tags["addr:full"] || "—"} />
          <InfoRow
            label="Wheelchair"
            value={tags.wheelchair || "—"}
            icon={<Accessibility className="h-3 w-3" />}
          />
          <InfoRow label="Parking" value={tags.parking || "—"} />
        </div>

        {/* Route alerts */}
        {(() => {
          const alerts: string[] = [];
          if (route.distanceKm > 25) alerts.push("Long route — plan for extended travel time");
          if (steps.some((s) => s.type === "roundabout")) alerts.push("Route includes roundabouts");
          if (steps.length > 20) alerts.push("Complex route with many turns");
          if (mode === "walking" && route.distanceKm > 5) alerts.push("Long walking distance");
          if (alerts.length === 0) return null;
          return (
            <div className="px-4 py-3 border-b border-border/50 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Route alerts
              </div>
              {alerts.map((a) => (
                <div key={a} className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {error && (
          <div className="px-4 py-2 text-[11px] text-destructive flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/50 space-y-2">
        {!navigating && !arrived && (
          <>
            <Button
              size="lg"
              className={`w-full h-11 text-sm font-semibold ${emergencyMode ? "bg-red-600 hover:bg-red-700" : ""}`}
              onClick={startNavigation}
              disabled={recomputing || !user}
            >
              {recomputing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Navigation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-red-500/40 text-red-600 hover:bg-red-500/10"
              onClick={emergencyStart}
            >
              <Ambulance className="h-3.5 w-3.5 mr-1" />
              Emergency Navigation
            </Button>
          </>
        )}
        {navigating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
                aria-label="Voice volume"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => speak(lastInstruction || "Continue on this road.", muted, volume)}
                title="Replay instruction"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="w-full h-9 text-xs"
              onClick={() => {
                stopNavigation();
                setRoute(null);
              }}
            >
              End Navigation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="flex-1 truncate capitalize">{value}</span>
    </div>
  );
}
