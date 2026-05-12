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
import { Pill, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/pharmacy")({ component: Pharmacy });

function Pharmacy() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const canPrescribe = role === "doctor" || role === "admin";
  const canDispense = role === "pharmacist" || role === "admin" || role === "doctor";
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["rx"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prescriptions")
        .select("id, medication, dosage, instructions, status, created_at, dispensed_at, patients(full_name), profiles:doctor_id(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const dispense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prescriptions").update({
        status: "dispensed", dispensed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dispensed"); qc.invalidateQueries({ queryKey: ["rx"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); },
  });

  return (
    <PageShell>
      <PageHeader
        title="Pharmacy"
        subtitle="Active prescriptions and dispensing queue."
        action={
          canPrescribe && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Pill className="size-4 mr-2" /> Prescribe</Button>
              </DialogTrigger>
              <NewRx uid={user?.id} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["rx"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); }} />
            </Dialog>
          )
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left border-b border-border">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Patient</th>
              <th className="px-4 py-2.5">Medication</th>
              <th className="px-4 py-2.5">Dosage</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No prescriptions.</td></tr>}
            {data.map((r: any) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-mono text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{r.patients?.full_name}</td>
                <td className="px-4 py-3">{r.medication}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.dosage || "—"}</td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                <td className="px-4 py-3 text-right">
                  {canDispense && r.status !== "dispensed" && (
                    <Button size="sm" variant="ghost" onClick={() => dispense.mutate(r.id)}>
                      <PackageCheck className="size-3.5 mr-1" /> Dispense
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

function NewRx({ uid, onDone }: { uid?: string; onDone: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data || [],
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!patientId || !medication) throw new Error("Patient & medication required");
      const { error } = await supabase.from("prescriptions").insert({
        patient_id: patientId, medication, dosage, instructions, doctor_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Prescription created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New prescription</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Medication</Label>
          <Input value={medication} onChange={e => setMedication(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Dosage</Label>
          <Input value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g. 500mg twice daily" />
        </div>
        <div className="space-y-1.5">
          <Label>Instructions</Label>
          <Input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="e.g. take with food" />
        </div>
      </div>
      <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Send to pharmacy"}</Button></DialogFooter>
    </DialogContent>
  );
}
