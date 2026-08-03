import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, MapPin, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NIGERIA_STATES, lgasOf, ALL_LGAS } from "@/lib/nigeria-admin";
import { getAdminBoundary } from "@/lib/admin-boundary.functions";
import { studyAreaFromCollection } from "@/lib/study-area";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

/** Boundaries stay cached for a day — reselecting an LGA is instant. */
const BOUNDARY_STALE = 24 * 60 * 60 * 1000;

function Combobox({
  value,
  placeholder,
  searchPlaceholder,
  options,
  onSelect,
  disabled,
  icon,
  widthClass = "w-[220px]",
  dataTour,
}: {
  value: string | null;
  placeholder: string;
  searchPlaceholder: string;
  options: { value: string; label: string; hint?: string }[];
  onSelect: (v: string) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  widthClass?: string;
  dataTour?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-tour={dataTour}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 justify-between gap-2 text-xs", widthClass)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {icon}
            <span className="truncate">{value ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("z-[1400] p-0", widthClass)} align="start">
        <Command
          filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} className="h-10 text-sm" />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onSelect(o.value);
                    setOpen(false);
                  }}
                  className="min-h-10 text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                  {o.hint && (
                    <span className="ml-auto pl-2 text-[10px] text-muted-foreground">{o.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Cascading State → LGA selector. Selecting an LGA loads its boundary,
 * which becomes the study area every OSM query and analysis is clipped to.
 */
export default function AdminAreaSelector({
  compact,
  stacked,
}: {
  compact?: boolean;
  stacked?: boolean;
}) {
  const state = useStore((s) => s.selectedState);
  const lga = useStore((s) => s.selectedLga);
  const setSelection = useStore((s) => s.setAdminSelection);
  const setStudyArea = useStore((s) => s.setStudyArea);
  const qc = useQueryClient();

  const stateOptions = useMemo(
    () => NIGERIA_STATES.map((s) => ({ value: s, label: s })),
    [],
  );
  const lgaOptions = useMemo(
    () => lgasOf(state).map(([n]) => ({ value: n, label: n, hint: state ?? undefined })),
    [state],
  );

  const boundary = useQuery({
    queryKey: ["admin-boundary", state, lga],
    queryFn: async () => {
      const fc = await getAdminBoundary({ data: { state: state!, lga } });
      return studyAreaFromCollection(fc, {
        name: lga ?? state!,
        state: state!,
        level: lga ? "ADM2" : "ADM1",
      });
    },
    enabled: !!state,
    staleTime: BOUNDARY_STALE,
    gcTime: BOUNDARY_STALE,
    retry: 1,
  });

  useEffect(() => {
    if (boundary.data) setStudyArea(boundary.data);
  }, [boundary.data, setStudyArea]);

  useEffect(() => {
    if (boundary.error) toast.error((boundary.error as Error).message);
  }, [boundary.error]);

  const loading = boundary.isFetching;

  const pickLga = (nextState: string, nextLga: string | null) => {
    setSelection(nextState, nextLga);
    // Warm the cache immediately for a snappier switch.
    void qc.prefetchQuery({
      queryKey: ["admin-boundary", nextState, nextLga],
      queryFn: async () => {
        const fc = await getAdminBoundary({ data: { state: nextState, lga: nextLga } });
        return studyAreaFromCollection(fc, {
          name: nextLga ?? nextState,
          state: nextState,
          level: nextLga ? "ADM2" : "ADM1",
        });
      },
      staleTime: BOUNDARY_STALE,
    });
  };

  return (
    <div
      data-tour="area-selector"
      data-tour-busy={loading ? "1" : undefined}
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        stacked && "flex-col items-stretch",
        compact && "rounded-lg bg-background/95 p-1.5 shadow backdrop-blur",
      )}
    >
      <Combobox
        dataTour="state-select"
        icon={<Landmark className="h-3.5 w-3.5 text-muted-foreground" />}
        value={state}
        placeholder="Select state"
        searchPlaceholder="Search states…"
        options={stateOptions}
        widthClass={stacked ? "w-full" : compact ? "w-[150px]" : "w-[170px]"}
        onSelect={(v) => pickLga(v, null)}
      />
      <Combobox
        dataTour="lga-select"
        icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
        value={lga}
        placeholder={state ? "Select LGA" : "Select state first"}
        searchPlaceholder="Search LGAs…"
        options={
          state
            ? lgaOptions
            : ALL_LGAS.map((o) => ({ value: o.lga, label: o.lga, hint: o.state }))
        }
        disabled={!state}
        widthClass={stacked ? "w-full" : compact ? "w-[170px]" : "w-[200px]"}
        onSelect={(v) => pickLga(state!, v)}
      />
      {loading && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading {state} State{lga ? ` → ${lga}` : ""}…
        </span>
      )}
    </div>
  );
}
