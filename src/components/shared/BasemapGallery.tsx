import { useStore } from "@/lib/store";
import { BASEMAP_LIST } from "@/lib/basemaps";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Layers, Check } from "lucide-react";

/** Basemap gallery — switches tiles live without reloading overlays or analysis. */
export default function BasemapGallery({ compact }: { compact?: boolean }) {
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const active = BASEMAP_LIST.find((b) => b.key === basemap) ?? BASEMAP_LIST[3];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size={compact ? "icon" : "sm"}
          variant="outline"
          className={
            compact
              ? "h-9 w-9 bg-background/95 backdrop-blur shadow"
              : "gap-1.5 bg-background/95 backdrop-blur"
          }
          aria-label="Basemap gallery"
          title="Basemap gallery"
        >
          <Layers className="h-4 w-4" />
          {!compact && <span className="text-xs">{active.label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2 z-[1200]">
        <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Basemap gallery
        </div>
        <div className="space-y-1">
          {BASEMAP_LIST.map((b) => (
            <button
              key={b.key}
              onClick={() => setBasemap(b.key)}
              className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted"
            >
              <span
                className="h-9 w-12 shrink-0 rounded border"
                style={{ background: b.swatch }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{b.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{b.blurb}</span>
              </span>
              {basemap === b.key && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
