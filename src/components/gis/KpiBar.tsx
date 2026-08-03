import { useMemo } from "react";
import { useHealthcare, useEmergency, useSettlements, useRoads, classifyFacility } from "@/hooks/useOverpass";
import { Card } from "@/components/ui/card";
import { Building2, Cross, HeartPulse, Pill, Users, Route as RouteIcon, Ambulance } from "lucide-react";

function Kpi({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-3 min-w-[150px] backdrop-blur bg-card/70 border">
      <div className="grid h-9 w-9 place-items-center rounded-md" style={{ background: `${color}20`, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">
          {loading ? <span className="inline-block h-4 w-10 bg-muted animate-pulse rounded" /> : value.toLocaleString()}
        </div>
      </div>
    </Card>
  );
}

export default function KpiBar() {
  const hc = useHealthcare();
  const em = useEmergency();
  const st = useSettlements();
  const rd = useRoads();

  const counts = useMemo(() => {
    const c = { hospital: 0, clinic: 0, pharmacy: 0, health_centre: 0 };
    (hc.data || []).forEach((e) => {
      const k = classifyFacility(e);
      if (k in c) (c as Record<string, number>)[k]++;
    });
    return c;
  }, [hc.data]);

  const busy = hc.isLoading || st.isLoading || rd.isLoading || em.isLoading;

  return (
    <div
      data-tour="kpi"
      data-tour-busy={busy ? "1" : undefined}
      className="flex gap-2 overflow-x-auto px-3 py-2 border-b bg-muted/40"
    >
      <Kpi icon={HeartPulse} label="Hospitals" value={counts.hospital} color="#dc2626" loading={hc.isLoading} />
      <Kpi icon={Cross} label="Clinics" value={counts.clinic} color="#2563eb" loading={hc.isLoading} />
      <Kpi icon={Pill} label="Pharmacies" value={counts.pharmacy} color="#16a34a" loading={hc.isLoading} />
      <Kpi icon={Building2} label="Health centres" value={counts.health_centre} color="#7c3aed" loading={hc.isLoading} />
      <Kpi icon={Users} label="Settlements" value={(st.data || []).length} color="#334155" loading={st.isLoading} />
      <Kpi icon={RouteIcon} label="Major roads" value={(rd.data || []).length} color="#f59e0b" loading={rd.isLoading} />
      <Kpi icon={Ambulance} label="Ambulance" value={(em.data || []).length} color="#ea580c" loading={em.isLoading} />
    </div>
  );
}
