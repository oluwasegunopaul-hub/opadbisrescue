import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  X,
  HelpCircle,
  BookOpen,
  Keyboard,
  MessageCircle,
  ListChecks,
  RefreshCw,
  Info,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "opadbisrescue:onboarding:v1";
const CHECKLIST_KEY = "opadbisrescue:checklist:v1";

// ---------------- Tour step definitions ----------------
type TourStep = {
  id: string;
  title: string;
  body: string;
  why: string;
  target?: string; // CSS selector; when omitted, renders centered modal
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  action?: { label: string; event: string };
  beforeShow?: () => void | Promise<void>;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Welcome to your Dashboard",
    body: "This is the opadbisrescue dashboard — your command center for exploring healthcare accessibility across Nigeria using live OpenStreetMap data.",
    why: "A single workspace to combine facilities, roads, boundaries and emergency response in one map view.",
    target: '[data-tour="dashboard"]',
    placement: "bottom",
  },
  {
    id: "map",
    title: "The Interactive Map",
    body: "Pan by dragging, zoom with the wheel or buttons, and click any feature to inspect it. The map streams OSM data progressively as you explore.",
    why: "Interactive exploration lets you focus on the region that matters right now, without loading the whole country at once.",
    target: '[data-tour="map"]',
    placement: "left",
  },
  {
    id: "search",
    title: "Search Bar",
    body: "Search hospitals, clinics, pharmacies, ambulance stations, towns and villages by name.",
    why: "Jump directly to a named place instead of hunting for it on the map.",
    target: '[data-tour="search"]',
    placement: "left",
  },
  {
    id: "locate",
    title: "Locate Me",
    body: "One click detects your current GPS location and finds the nearest hospital, clinic, pharmacy and ambulance station.",
    why: "Emergency response depends on knowing what is closest to you, right now.",
    target: '[data-tour="locate"]',
    placement: "right",
    action: { label: "Try Locate Me", event: "opadbisrescue:locate-me" },
  },
  {
    id: "layers",
    title: "Layer Control",
    body: "Toggle healthcare categories, roads, waterways, buildings, transport and the administrative boundary on or off.",
    why: "Show only the data you need so the map stays clear and readable.",
    target: '[data-tour="layers"]',
    placement: "left",
  },
  {
    id: "filter",
    title: "Filter Panel",
    body: "Narrow facilities by type — hospitals, clinics, pharmacies, health centres or doctors — and switch basemaps.",
    why: "Filters help you compare like with like when studying accessibility gaps.",
    target: '[data-tour="filter"]',
    placement: "left",
  },
  {
    id: "analytics",
    title: "Analytics Panel",
    body: "Live charts summarize healthcare mix and emergency infrastructure inside the current view.",
    why: "Turns raw features into decision-ready statistics you can act on.",
    target: '[data-tour="analytics"]',
    placement: "left",
  },
  {
    id: "facility",
    title: "Facility Information",
    body: "Every facility exposes its name, address, contact details, opening hours and services. Click a row or marker to inspect it.",
    why: "Rich attribute data helps responders and planners make informed decisions.",
    target: '[data-tour="facility-table"]',
    placement: "top",
  },
  {
    id: "navigate",
    title: "Route & Navigation",
    body: "From any nearest-facility card, click Navigate to draw the fastest driving or walking route from your position.",
    why: "A visible route removes guesswork in a real emergency.",
    target: '[data-tour="nearest-panel"]',
    placement: "left",
  },
  {
    id: "nav-guide",
    title: "Navigation Guide",
    body: "Once a route is active, the guide shows distance, ETA and live progress toward the destination.",
    why: "Live feedback keeps you oriented while moving.",
    target: '[data-tour="nearest-panel"]',
    placement: "left",
  },
  {
    id: "export",
    title: "Export",
    body: "Export the currently visible facilities as CSV or GeoJSON for offline analysis or reporting.",
    why: "Interoperability with QGIS, ArcGIS, Excel and BI tools keeps your workflow open.",
    target: '[data-tour="export"]',
    placement: "left",
  },
];

// ---------------- Utility: wait for element ----------------
async function waitForEl(selector: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// ---------------- Spotlight overlay ----------------
type Rect = { top: number; left: number; width: number; height: number };

function useElementRect(el: HTMLElement | null, active: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!el || !active) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const iv = window.setInterval(update, 250);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(iv);
    };
  }, [el, active]);
  return rect;
}

function popoverPosition(rect: Rect, placement: TourStep["placement"], vw: number, vh: number) {
  const PW = 340;
  const PH = 220;
  const GAP = 14;
  let top = 0;
  let left = 0;
  const place = placement && placement !== "auto" ? placement : (() => {
    const spaceRight = vw - (rect.left + rect.width);
    const spaceLeft = rect.left;
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const best = Math.max(spaceRight, spaceLeft, spaceBelow, spaceAbove);
    if (best === spaceRight) return "right";
    if (best === spaceLeft) return "left";
    if (best === spaceBelow) return "bottom";
    return "top";
  })();

  switch (place) {
    case "top":
      top = rect.top - PH - GAP;
      left = rect.left + rect.width / 2 - PW / 2;
      break;
    case "bottom":
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - PW / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - PH / 2;
      left = rect.left - PW - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - PH / 2;
      left = rect.left + rect.width + GAP;
      break;
    case "center":
    default:
      top = vh / 2 - PH / 2;
      left = vw / 2 - PW / 2;
  }
  // Clamp inside viewport
  top = Math.max(12, Math.min(vh - PH - 12, top));
  left = Math.max(12, Math.min(vw - PW - 12, left));
  return { top, left, width: PW };
}

// ---------------- Getting Started (Welcome + Tour) ----------------
type Mode = "welcome" | "tour" | "done";

export function GettingStartedGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("welcome");
      setStepIndex(0);
    }
  }, [open]);

  // Resolve target element for current step
  useEffect(() => {
    if (mode !== "tour") return;
    let cancelled = false;
    const step = TOUR_STEPS[stepIndex];
    if (!step?.target) {
      setTargetEl(null);
      return;
    }
    setResolving(true);
    setTargetEl(null);
    (async () => {
      if (step.beforeShow) {
        try { await step.beforeShow(); } catch { /* noop */ }
      }
      const el = await waitForEl(step.target!, 2500);
      if (cancelled) return;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        // give the browser a moment to settle scroll before measuring
        setTimeout(() => {
          if (!cancelled) {
            setTargetEl(el);
            setResolving(false);
          }
        }, 350);
      } else {
        // Gracefully skip missing steps
        setResolving(false);
        setStepIndex((i) => Math.min(TOUR_STEPS.length, i + 1));
      }
    })();
    return () => { cancelled = true; };
  }, [mode, stepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (mode !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stepIndex]);

  const rect = useElementRect(targetEl, mode === "tour");

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const finish = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, "completed"); } catch { /* noop */ }
    onOpenChange(false);
  }, [onOpenChange]);

  const skip = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, "skipped"); } catch { /* noop */ }
    onOpenChange(false);
  }, [onOpenChange]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        setMode("done");
        return i;
      }
      return i + 1;
    });
  }, []);
  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / total) * 100;
  const isLast = stepIndex === total - 1;

  // ---------------- Welcome modal ----------------
  if (mode === "welcome") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border-white/20 bg-background/95 backdrop-blur-xl z-[10001]">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent pointer-events-none" />
            <div className="relative p-8">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg animate-scale-in">
                <Sparkles className="h-8 w-8" />
              </div>
              <DialogHeader className="text-center space-y-2">
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  Welcome to opadbisrescue
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Take a 60-second guided tour of the healthcare accessibility dashboard.
                </p>
              </DialogHeader>
              <div className="mt-7 flex items-center gap-2">
                <Button variant="ghost" className="flex-1" onClick={skip}>
                  Skip tour
                </Button>
                <Button className="flex-1" onClick={() => setMode("tour")}>
                  Start tour <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------------- Completion screen ----------------
  if (mode === "done") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl z-[10001]">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-primary/5 to-transparent pointer-events-none" />
            <div className="relative p-8 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg animate-scale-in">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Congratulations!</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                You've completed the guided tour and are ready to explore the Healthcare
                Accessibility Dashboard.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => { setMode("tour"); setStepIndex(0); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Restart tour
                </Button>
                <Button onClick={finish}>Start exploring</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------------- Interactive tour (spotlight + popover) ----------------
  if (!open) return null;

  const hasTarget = !!rect;
  const pos = hasTarget && current.placement !== "center"
    ? popoverPosition(rect!, current.placement, vw, vh)
    : { top: vh / 2 - 140, left: vw / 2 - 170, width: 340 };

  const PAD = 8;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none" aria-live="polite">
      {/* Spotlight mask via SVG — leaves a clean cutout over the target */}
      <svg
        className="fixed inset-0 h-full w-full pointer-events-auto"
        onClick={(e) => { if (e.target === e.currentTarget) { /* keep tour focused */ } }}
        style={{ zIndex: 9998 }}
      >
        <defs>
          <mask id="hr-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={rect!.left - PAD}
                y={rect!.top - PAD}
                width={rect!.width + PAD * 2}
                height={rect!.height + PAD * 2}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(2, 6, 23, 0.72)"
          mask="url(#hr-tour-mask)"
          className="transition-opacity duration-300"
        />
        {hasTarget && (
          <rect
            x={rect!.left - PAD}
            y={rect!.top - PAD}
            width={rect!.width + PAD * 2}
            height={rect!.height + PAD * 2}
            rx={10}
            fill="none"
            stroke="rgb(59,130,246)"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Popover */}
      <div
        role="dialog"
        aria-label={current.title}
        className="fixed pointer-events-auto rounded-2xl border border-white/20 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 10000 }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Step {stepIndex + 1} of {total}
              </div>
              <button
                onClick={skip}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Close
              </button>
            </div>
            <Progress value={progress} className="h-1 mb-3" />

            <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              {current.title}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {resolving ? "Loading…" : current.body}
            </p>
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-primary/5 border border-primary/10 px-2 py-1.5">
              <Lightbulb className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground/80 leading-relaxed">{current.why}</p>
            </div>

            {current.action && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(current.action!.event));
                }}
              >
                {current.action.label}
              </Button>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={prev} disabled={stepIndex === 0}>
                <ArrowLeft className="h-3 w-3 mr-1" /> Prev
              </Button>
              <button
                onClick={skip}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Skip tour
              </button>
              {isLast ? (
                <Button size="sm" onClick={() => setMode("done")}>
                  Finish <CheckCircle2 className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={next}>
                  Next <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Quick Start Checklist ----------------
const CHECKLIST_ITEMS = [
  { id: "locate", label: "Find my location" },
  { id: "hospital", label: "Locate the nearest hospital" },
  { id: "search", label: "Search for a clinic" },
  { id: "layers", label: "Explore map layers" },
  { id: "route", label: "Generate a route" },
  { id: "stats", label: "View healthcare statistics" },
];

export function QuickStartChecklist() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  const toggle = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const completed = CHECKLIST_ITEMS.filter((i) => done[i.id]).length;
  const total = CHECKLIST_ITEMS.length;
  const allDone = completed === total;

  return (
    <div className="absolute bottom-3 left-3 z-[500] w-[260px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/20 dark:border-white/10 bg-background/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <ListChecks className="h-4 w-4 text-primary" />
        <span>Quick start</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {completed}/{total}
        </span>
      </button>
      {open && (
        <div className="border-t border-border/50 p-2 space-y-1 animate-fade-in">
          <div className="px-2 pb-1">
            <Progress value={(completed / total) * 100} className="h-1" />
          </div>
          {CHECKLIST_ITEMS.map((item) => {
            const isDone = !!done[item.id];
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50 text-left"
              >
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded border transition-colors shrink-0",
                    isDone ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {isDone && <CheckCircle2 className="h-3 w-3" />}
                </span>
                <span className={cn(isDone && "line-through text-muted-foreground")}>{item.label}</span>
              </button>
            );
          })}
          {allDone && (
            <div className="px-2 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> All tasks complete — great work!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- Help menu ----------------
export function HelpMenu({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "manual" | "faq" | "shortcuts" | "contact" | "about">("menu");

  const items = [
    { id: "restart", label: "Restart the guided tour", icon: RefreshCw, action: () => { setOpen(false); onOpenGuide(); } },
    { id: "manual", label: "User Manual", icon: BookOpen, action: () => setView("manual") },
    { id: "faq", label: "Frequently Asked Questions", icon: HelpCircle, action: () => setView("faq") },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, action: () => setView("shortcuts") },
    { id: "contact", label: "Contact Support", icon: MessageCircle, action: () => setView("contact") },
    { id: "about", label: "About the Dashboard", icon: Info, action: () => setView("about") },
  ];

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1"
        data-tour="help"
        onClick={() => { setView("menu"); setOpen(true); }}
        aria-label="Help and guides"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Help</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl z-[10001]">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                {view === "menu" ? "Help & Guides" :
                 view === "manual" ? "User Manual" :
                 view === "faq" ? "Frequently Asked Questions" :
                 view === "shortcuts" ? "Keyboard Shortcuts" :
                 view === "contact" ? "Contact Support" : "About the Dashboard"}
              </DialogTitle>
            </DialogHeader>

            {view === "menu" ? (
              <div className="mt-4 grid gap-1">
                {items.map(({ id, label, icon: I, action }) => (
                  <button
                    key={id}
                    onClick={action}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/60 text-left transition-colors"
                  >
                    <I className="h-4 w-4 text-primary" />
                    <span className="flex-1">{label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-muted-foreground max-h-[60vh] overflow-y-auto">
                {view === "manual" && (
                  <>
                    <p>opadbisrescue is a healthcare accessibility dashboard powered by OpenStreetMap.</p>
                    <p><strong className="text-foreground">Locate Me:</strong> Detects your location and finds the nearest emergency facilities.</p>
                    <p><strong className="text-foreground">Search:</strong> Find any facility, town or village.</p>
                    <p><strong className="text-foreground">Layers:</strong> Toggle facility categories, roads and boundaries.</p>
                    <p><strong className="text-foreground">Navigation:</strong> Click Navigate on any facility card to draw the fastest route.</p>
                  </>
                )}
                {view === "faq" && (
                  <>
                    <div><strong className="text-foreground">Why is the map slow to load?</strong> Data streams progressively from OpenStreetMap; zoom into a region for details.</div>
                    <div><strong className="text-foreground">Location denied?</strong> Enable browser location permission for this site.</div>
                    <div><strong className="text-foreground">Where does data come from?</strong> OpenStreetMap contributors via the Overpass API.</div>
                    <div><strong className="text-foreground">Is my data private?</strong> Your GPS position is used only in the browser — never sent to our servers.</div>
                  </>
                )}
                {view === "shortcuts" && (
                  <ul className="space-y-2">
                    {[
                      ["+ / −", "Zoom in / out"],
                      ["Arrow keys", "Next / previous step (during tour)"],
                      ["Enter", "Next step (during tour)"],
                      ["Esc", "Close panels / tour"],
                      ["?", "Open help"],
                    ].map(([k, d]) => (
                      <li key={k} className="flex items-center justify-between border-b border-border/50 pb-1">
                        <span className="text-foreground">{d}</span>
                        <kbd className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">{k}</kbd>
                      </li>
                    ))}
                  </ul>
                )}
                {view === "contact" && (
                  <>
                    <p>Reach the opadbisrescue team:</p>
                    <p><strong className="text-foreground">Email:</strong> support@opadbisrescue.ng</p>
                    <p>We reply to support requests within one business day.</p>
                  </>
                )}
                {view === "about" && (
                  <>
                    <p>opadbisrescue maps healthcare accessibility and emergency response across Nigeria using open data.</p>
                    <p>Basemap and features © OpenStreetMap contributors. Routing © OSRM.</p>
                    <p className="text-xs">Version 1.0</p>
                  </>
                )}
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setView("menu")}>
                    <ArrowLeft className="h-3 w-3 mr-1" /> Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useFirstVisitGuide() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch { /* noop */ }
  }, []);
  return { open, setOpen };
}
