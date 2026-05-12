import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageShell, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/appointments")({ component: Appts });

function Appts() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canCreate = role === "receptionist" || role === "admin" || role === "doctor";
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, reason, patient_id, doctor_id, patients(full_name), profiles:doctor_id(full_name)")
        .order("scheduled_at", { ascending: true });
      return data || [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Appointments"
        subtitle="Schedule, dispatch and track every consultation."
        action={
          canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><CalendarPlus className="size-4 mr-2" /> Book appointment</Button>
              </DialogTrigger>
              <NewAppt onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["appointments"] }); }} />
            </Dialog>
          )
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left border-b border-border">
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Patient</th>
              <th className="px-4 py-2.5">Doctor</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No appointments scheduled.</td></tr>}
            {data.map((a: any) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-mono text-xs">{new Date(a.scheduled_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{a.patients?.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.profiles?.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{a.reason || "—"}</td>
                <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                <td className="px-4 py-3 text-right">
                  {a.status !== "completed" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "completed" })}>
                      <CheckCircle2 className="size-3.5 mr-1" /> Complete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function NewAppt({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [doctorId, setDoctorId] = useState<string>("self");

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data || [],
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "doctor");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data || [];
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!patientId || !scheduledAt) throw new Error("Patient & time required");
      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        reason,
        doctor_id: doctorId === "self" ? user?.id : doctorId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Appointment booked"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Book appointment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
            <SelectContent>
              {patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Doctor</Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Assign to me</SelectItem>
              {doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date & time</Label>
          <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. follow-up consultation" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Booking…" : "Book"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
