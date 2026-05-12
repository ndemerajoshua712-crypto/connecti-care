import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageShell } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePlus, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/records")({ component: Records });

function Records() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canWrite = role === "doctor" || role === "admin";
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medical_records")
        .select("id, diagnosis, treatment, notes, created_at, patients(full_name), profiles:doctor_id(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Electronic Health Records"
        subtitle="Diagnoses, treatments and clinical notes — searchable across the hospital."
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><FilePlus className="size-4 mr-2" /> New record</Button>
              </DialogTrigger>
              <NewRecord onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["records"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); }} />
            </Dialog>
          )
        }
      />

      <div className="space-y-3">
        {data.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            No medical records yet.
          </div>
        )}
        {data.map((r: any) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-9 rounded-md bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center shrink-0">
                  <Stethoscope className="size-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{r.patients?.full_name}</div>
                  <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {r.profiles?.full_name || "Unknown doctor"} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Diagnosis</div>
                <div>{r.diagnosis}</div>
              </div>
              <div>
                <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Treatment</div>
                <div className="text-muted-foreground">{r.treatment || "—"}</div>
              </div>
              <div>
                <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                <div className="text-muted-foreground">{r.notes || "—"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function NewRecord({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data || [],
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!patientId || !diagnosis) throw new Error("Patient & diagnosis required");
      const { error } = await supabase.from("medical_records").insert({
        patient_id: patientId, diagnosis, treatment, notes, doctor_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Record created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New medical record</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
            <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Diagnosis *</Label>
          <Input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Treatment plan</Label>
          <Textarea value={treatment} onChange={e => setTreatment(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Clinical notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Save record"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
