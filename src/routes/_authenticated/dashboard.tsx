import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageShell } from "@/components/page";
import { Users, CalendarDays, FlaskConical, Receipt, Activity, ClipboardList, Pill } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { fullName } = useAuth();

  const counts = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [patients, todayAppts, pendingLabs, pendingRx, unpaidBills, records] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .gte("scheduled_at", today.toISOString()).lt("scheduled_at", tomorrow.toISOString()),
        supabase.from("lab_tests").select("*", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("prescriptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("bills").select("total").eq("status", "unpaid"),
        supabase.from("medical_records").select("*", { count: "exact", head: true }),
      ]);

      const unpaidTotal = (unpaidBills.data || []).reduce((s, b: any) => s + Number(b.total || 0), 0);

      return {
        patients: patients.count ?? 0,
        todayAppts: todayAppts.count ?? 0,
        pendingLabs: pendingLabs.count ?? 0,
        pendingRx: pendingRx.count ?? 0,
        unpaidTotal,
        records: records.count ?? 0,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["recent-appointments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, reason, patients(full_name)")
        .order("scheduled_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  const stats = [
    { label: "Total Patients", value: counts.data?.patients, icon: Users, accent: "text-primary" },
    { label: "Appointments Today", value: counts.data?.todayAppts, icon: CalendarDays, accent: "text-accent" },
    { label: "Pending Labs", value: counts.data?.pendingLabs, icon: FlaskConical, accent: "text-warning" },
    { label: "Rx to Dispense", value: counts.data?.pendingRx, icon: Pill, accent: "text-warning" },
    { label: "Records on File", value: counts.data?.records, icon: ClipboardList, accent: "text-primary" },
    { label: "Unpaid Revenue", value: counts.data ? `$${counts.data.unpaidTotal.toFixed(2)}` : null, icon: Receipt, accent: "text-accent" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Command Dashboard"
        subtitle={`Welcome back${fullName ? `, ${fullName}` : ""}. Live snapshot of hospital operations.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 ring-glow">
            <div className="flex items-center justify-between">
              <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <s.icon className={`size-4 ${s.accent}`} />
            </div>
            <div className="mt-3 text-3xl font-bold text-mono">
              {s.value ?? <span className="text-muted-foreground/40">—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {(recent.data || []).length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">No appointments yet.</div>
          )}
          {(recent.data || []).map((a: any) => (
            <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.patients?.full_name || "Unknown patient"}</div>
                <div className="text-muted-foreground text-xs truncate">{a.reason || "Consultation"}</div>
              </div>
              <div className="text-mono text-xs text-muted-foreground whitespace-nowrap">
                {new Date(a.scheduled_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
