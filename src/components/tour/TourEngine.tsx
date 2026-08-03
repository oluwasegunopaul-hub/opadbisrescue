import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  HelpCircle,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  Timer,
  X,
} from "lucide-react";

/** One tour step. Every step answers what / does / why / when. */
export type TourStep = {
  id: string;
  title: string;
  /** What is this? */
  what: string;
  /** What does it do? */
  does: string;
  /** Why should I use it? */
  why: string;
  /** When should I use it? */
  when: string;
  /** CSS selector of the element to spotlight. Omit for a centered step. */
  target?: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  /** Reveal / expand / open whatever the step needs before highlighting. */
  before?: () => void | Promise<void>;
  /** Optional extra "try it" action button. */
  action?: { label: string; run: () => void };
};

export type TourDefinition = {
  id: string;
  name: string;
  welcome: { title: string; intro: string; points: string[] };
  finish: { title: string; intro: string; points: string[] };
  steps: TourStep[];
};

const CARD_W = 380;
const GAP = 16;

/** Anything rendering this attribute pauses the tour until it disappears. */
export const TOUR_BUSY_ATTR = "data-tour-busy";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForEl(selector: string, timeoutMs = 4000) {
  const start = Date.now();
  for (;;) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el && el.offsetParent !== null) return el;
    if (el && el.getBoundingClientRect().width > 0) return el;
    if (Date.now() - start > timeoutMs) return null;
    await sleep(80);
  }
}

/** Pause while asynchronous data / map layers are still loading. */
async function waitWhileBusy(timeoutMs = 12000, onBusy?: (b: boolean) => void) {
  const start = Date.now();
  let paused = false;
  while (document.querySelector(`[${TOUR_BUSY_ATTR}="1"]`)) {
    if (!paused) {
      paused = true;
      onBusy?.(true);
    }
    if (Date.now() - start > timeoutMs) break;
    await sleep(200);
  }
  if (paused) onBusy?.(false);
}

type Rect = { top: number; left: number; width: number; height: number };

function useLiveRect(el: HTMLElement | null, active: boolean) {
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
    const iv = window.setInterval(update, 300);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(iv);
    };
  }, [el, active]);
  return rect;
}

function place(rect: Rect | null, placement: TourStep["placement"], h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || placement === "center") {
    return { top: Math.max(12, vh / 2 - h / 2), left: Math.max(12, vw / 2 - CARD_W / 2) };
  }
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  let p = placement && placement !== "auto" ? placement : "auto";
  if (p === "auto" || (p === "right" && spaceRight < CARD_W + GAP) ||
      (p === "left" && spaceLeft < CARD_W + GAP) ||
      (p === "bottom" && spaceBelow < h + GAP) ||
      (p === "top" && spaceAbove < h + GAP)) {
    const best = Math.max(spaceRight, spaceLeft, spaceBelow, spaceAbove);
    p = best === spaceRight ? "right" : best === spaceLeft ? "left" : best === spaceBelow ? "bottom" : "top";
  }
  let top = 0;
  let left = 0;
  if (p === "top") {
    top = rect.top - h - GAP;
    left = rect.left + rect.width / 2 - CARD_W / 2;
  } else if (p === "bottom") {
    top = rect.top + rect.height + GAP;
    left = rect.left + rect.width / 2 - CARD_W / 2;
  } else if (p === "left") {
    top = rect.top + rect.height / 2 - h / 2;
    left = rect.left - CARD_W - GAP;
  } else {
    top = rect.top + rect.height / 2 - h / 2;
    left = rect.left + rect.width + GAP;
  }
  top = Math.max(12, Math.min(vh - h - 12, top));
  left = Math.max(12, Math.min(vw - CARD_W - 12, left));
  return { top, left };
}

type Mode = "welcome" | "tour" | "done";

export default function GuidedTour({
  tour,
  open,
  onOpenChange,
}: {
  tour: TourDefinition;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("welcome");
  const [index, setIndex] = useState(0);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "waiting">("idle");
  const dir = useRef(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(300);

  useEffect(() => {
    if (open) {
      setMode("welcome");
      setIndex(0);
      dir.current = 1;
    }
  }, [open, tour.id]);

  const steps = tour.steps;
  const step = steps[index];

  // Resolve the target for the current step (reveal → wait → scroll → measure).
  useEffect(() => {
    if (!open || mode !== "tour" || !step) return;
    let cancelled = false;
    setEl(null);
    setStatus("preparing");
    (async () => {
      try {
        await step.before?.();
      } catch {
        /* a missing control must never break the tour */
      }
      if (cancelled) return;
      await sleep(120);
      await waitWhileBusy(12000, (b) => !cancelled && setStatus(b ? "waiting" : "preparing"));
      if (cancelled) return;
      if (!step.target) {
        setStatus("idle");
        return;
      }
      const found = await waitForEl(step.target, 4000);
      if (cancelled) return;
      if (!found) {
        // Skip gracefully in the direction of travel.
        setStatus("idle");
        setIndex((i) => {
          const n = i + dir.current;
          if (n < 0) return 0;
          if (n > steps.length - 1) {
            setMode("done");
            return i;
          }
          return n;
        });
        return;
      }
      found.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      await sleep(320);
      if (cancelled) return;
      setEl(found);
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, index, step, steps.length]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, mode, status, el]);

  const rect = useLiveRect(el, mode === "tour");

  const close = useCallback(() => {
    onOpenChange(false);
    setMode("welcome");
  }, [onOpenChange]);

  const next = useCallback(() => {
    dir.current = 1;
    setIndex((i) => {
      if (i >= steps.length - 1) {
        setMode("done");
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prev = useCallback(() => {
    dir.current = -1;
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!open || mode !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, close, next, prev]);

  if (!open) return null;

  // ---------- Welcome ----------
  if (mode === "welcome") {
    return (
      <Shell onClose={close}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight">{tour.welcome.title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{tour.welcome.intro}</p>
        <ul className="mt-4 space-y-1.5">
          {tour.welcome.points.map((p) => (
            <li key={p} className="flex gap-2 text-xs text-muted-foreground">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            Skip tour
          </Button>
          <Button className="flex-1" onClick={() => setMode("tour")}>
            Start tour ({steps.length} steps) <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  // ---------- Completion ----------
  if (mode === "done") {
    return (
      <Shell onClose={close}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight">{tour.finish.title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{tour.finish.intro}</p>
        <ul className="mt-4 space-y-1.5">
          {tour.finish.points.map((p) => (
            <li key={p} className="flex gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              dir.current = 1;
              setIndex(0);
              setMode("tour");
            }}
          >
            Restart
          </Button>
          <Button className="flex-1" onClick={close}>
            Start exploring
          </Button>
        </div>
      </Shell>
    );
  }

  // ---------- Spotlight ----------
  const PAD = 8;
  const pos = place(rect, step?.placement, cardH);
  const progress = ((index + 1) / steps.length) * 100;
  const isLast = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[10040]" aria-live="polite">
      <svg className="fixed inset-0 h-full w-full">
        <defs>
          <mask id={`tour-mask-${tour.id}`}>
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2,6,23,0.7)" mask={`url(#tour-mask-${tour.id})`} />
        {rect && (
          <rect
            x={rect.left - PAD}
            y={rect.top - PAD}
            width={rect.width + PAD * 2}
            height={rect.height + PAD * 2}
            rx={12}
            fill="none"
            stroke="hsl(217 91% 60%)"
            strokeWidth={2}
          />
        )}
      </svg>

      <div
        ref={cardRef}
        role="dialog"
        aria-label={step?.title}
        className="fixed z-[10050] overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ top: pos.top, left: pos.left, width: CARD_W, maxWidth: "92vw" }}
      >
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Compass className="h-3.5 w-3.5 text-primary" />
              {tour.name} · Step {index + 1} of {steps.length}
            </div>
            <button
              onClick={close}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          <Progress value={progress} className="mb-3 h-1" />

          <h3 className="text-base font-semibold tracking-tight">{step?.title}</h3>

          {status === "waiting" ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for map layers and data to
              finish loading…
            </p>
          ) : (
            <div className="mt-2 space-y-2 text-xs leading-relaxed">
              <Line icon={<HelpCircle className="h-3 w-3 text-primary" />} label="What is this">
                {step?.what}
              </Line>
              <Line icon={<Target className="h-3 w-3 text-primary" />} label="What it does">
                {step?.does}
              </Line>
              <div className="flex items-start gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <p className="text-[11px] text-foreground/85">
                  <span className="font-medium">Why it matters: </span>
                  {step?.why}
                </p>
              </div>
              <Line icon={<Timer className="h-3 w-3 text-primary" />} label="When to use it">
                {step?.when}
              </Line>
            </div>
          )}

          {step?.action && (
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={step.action.run}>
              {step.action.label}
            </Button>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={prev} disabled={index === 0}>
              <ArrowLeft className="mr-1 h-3 w-3" /> Previous
            </Button>
            <button
              onClick={close}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Skip tour
            </button>
            {isLast ? (
              <Button size="sm" onClick={() => setMode("done")}>
                Finish tour <CheckCircle2 className="ml-1 h-3 w-3" />
              </Button>
            ) : (
              <Button size="sm" onClick={next}>
                Next <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{label}: </span>
        {children}
      </p>
    </div>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10040] grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[10050] w-full max-w-[520px] rounded-2xl border bg-background/95 p-7 shadow-2xl backdrop-blur-xl animate-scale-in">
        {children}
      </div>
    </div>
  );
}
