import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import LeftNav from "@/components/gis/LeftNav";
import RightPanel from "@/components/gis/RightPanel";
import KpiBar from "@/components/gis/KpiBar";
import BottomPanel from "@/components/gis/BottomPanel";
import { useHydrated } from "@/hooks/use-hydrated";
import { useStore } from "@/lib/store";
import { Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HelpMenu,
  QuickStartChecklist,
  useFirstVisitGuide,
} from "@/components/gis/GettingStartedGuide";
import GuidedTour from "@/components/tour/TourEngine";
import { accessibilityTour } from "@/components/tour/accessibility-tour";


const OyoMap = lazy(() => import("@/components/gis/OyoMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "opadbisrescue — Healthcare Accessibility GIS" },
      {
        name: "description",
        content:
          "Enterprise GIS dashboard mapping healthcare accessibility and emergency response across Nigeria using OpenStreetMap data.",
      },
      { property: "og:title", content: "opadbisrescue — Healthcare Accessibility GIS" },
      {
        property: "og:description",
        content:
          "Enterprise GIS dashboard mapping healthcare accessibility and emergency response across Nigeria using OpenStreetMap data.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const hydrated = useHydrated();
  const nav = useStore((s) => s.nav);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const { open: guideOpen, setOpen: setGuideOpen } = useFirstVisitGuide();

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <header
        data-tour="dashboard"
        className="flex items-center justify-between border-b px-4 py-2 bg-card"
      >
        <div className="flex items-center gap-3">
          <Button data-tour="menu-toggle" size="icon" variant="ghost" onClick={() => setLeftOpen((v) => !v)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <div className="text-sm font-semibold">opadbisrescue</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Healthcare accessibility & emergency response
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live OpenStreetMap · Mode:{" "}
          <span className="capitalize font-medium text-foreground">{nav}</span>
          <Link to="/quality">
            <Button data-tour="quality-link" size="sm" variant="outline" className="gap-1.5 ml-2">
              <ShieldCheck className="h-3.5 w-3.5" /> OSM Data Quality
            </Button>
          </Link>
          <HelpMenu onOpenGuide={() => setGuideOpen(true)} />
          <Button data-tour="panel-toggle" size="sm" variant="ghost" onClick={() => setRightOpen((v) => !v)}>
            Panel
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {leftOpen && (
          <div className="animate-in slide-in-from-left-4 duration-300">
            <LeftNav onOpenGuide={() => setGuideOpen(true)} />
          </div>
        )}
        <main className="flex flex-1 flex-col overflow-hidden">
          <KpiBar />
          <div className="flex-1 relative">
            {hydrated ? (
              <Suspense
                fallback={
                  <div className="grid h-full place-items-center text-muted-foreground text-sm">
                    Loading map…
                  </div>
                }
              >
                <OyoMap />
                <QuickStartChecklist />
              </Suspense>
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground text-sm">
                Initializing map…
              </div>
            )}
          </div>
          <BottomPanel />
        </main>
        {rightOpen && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <RightPanel />
          </div>
        )}
      </div>

      <GuidedTour
        tour={accessibilityTour}
        open={guideOpen}
        onOpenChange={(v) => {
          setGuideOpen(v);
          if (!v) {
            try {
              localStorage.setItem("opadbisrescue:onboarding:v1", "1");
            } catch {
              /* ignore */
            }
          }
        }}
      />
    </div>
  );
}
