import { useStore, type NavKey } from "@/lib/store";
import {
  LayoutDashboard,
  HeartPulse,
  Route as RouteIcon,
  Siren,
  BarChart3,
  Settings,
  Moon,
  Sun,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import AdminAreaSelector from "@/components/shared/AdminAreaSelector";

const NAV: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse },
  { key: "accessibility", label: "Accessibility", icon: RouteIcon },
  { key: "emergency", label: "Emergency", icon: Siren },
  { key: "statistics", label: "Statistics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function LeftNav({ onOpenGuide }: { onOpenGuide?: () => void } = {}) {
  const nav = useStore((s) => s.nav);
  const setNav = useStore((s) => s.setNav);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div data-tour="app-logo" className="flex items-center gap-2 px-4 py-4 border-b">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">opadbisrescue</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            GIS Dashboard
          </div>
        </div>
      </div>

      <div className="border-b p-3 space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Study area
        </div>
        <AdminAreaSelector stacked />
      </div>

      <nav data-tour="main-nav" className="flex-1 p-2 space-y-1">

        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            data-tour={`nav-${key}`}
            onClick={() => setNav(key)}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              nav === key
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div data-tour="settings" className="border-t p-3 space-y-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === "light" ? "Dark mode" : "Light mode"}
        </Button>
        {onOpenGuide && (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onOpenGuide}>
            <HelpCircle className="h-4 w-4" />
            Getting started guide
          </Button>
        )}
        <div className="text-[10px] text-muted-foreground text-center pt-1">
          Data © OpenStreetMap contributors
        </div>
      </div>
    </aside>
  );
}
