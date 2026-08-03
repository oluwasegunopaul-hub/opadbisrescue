import { useMemo } from "react";
import { useHealthcare, classifyFacility } from "@/hooks/useOverpass";
import { useStore } from "@/lib/store";
import { elementCoords } from "@/lib/oyo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function BottomPanel() {
  const hc = useHealthcare();
  const facilityFilter = useStore((s) => s.facilityFilter);
  const search = useStore((s) => s.search);
  const setSelected = useStore((s) => s.setSelected);

  const rows = useMemo(() => {
    return (hc.data || []).filter((el) => {
      const k = classifyFacility(el);
      if (facilityFilter !== "all" && k !== facilityFilter) return false;
      if (search && !(el.tags?.name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).slice(0, 200);
  }, [hc.data, facilityFilter, search]);

  return (
    <div data-tour="facility-table" className="h-[200px] shrink-0 border-t bg-card overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-xs font-semibold">Facility table ({rows.length})</div>
        <div className="text-[10px] text-muted-foreground">Click a row to focus</div>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="h-8 text-xs">Name</TableHead>
              <TableHead className="h-8 text-xs">Type</TableHead>
              <TableHead className="h-8 text-xs">Operator</TableHead>
              <TableHead className="h-8 text-xs">Phone</TableHead>
              <TableHead className="h-8 text-xs">Lat</TableHead>
              <TableHead className="h-8 text-xs">Lng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((el) => {
              const c = elementCoords(el);
              return (
                <TableRow key={`${el.type}-${el.id}`} className="cursor-pointer text-xs" onClick={() => setSelected(el)}>
                  <TableCell className="py-1">{el.tags?.name || <span className="text-muted-foreground">Unnamed</span>}</TableCell>
                  <TableCell className="py-1">
                    <Badge variant="secondary" className="capitalize text-[10px]">{classifyFacility(el).replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="py-1">{el.tags?.operator || "—"}</TableCell>
                  <TableCell className="py-1">{el.tags?.phone || el.tags?.["contact:phone"] || "—"}</TableCell>
                  <TableCell className="py-1 tabular-nums">{c?.[0].toFixed(4) ?? "—"}</TableCell>
                  <TableCell className="py-1 tabular-nums">{c?.[1].toFixed(4) ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                  No facilities match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
