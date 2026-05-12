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
import { FlaskConical, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/lab")({ component: Lab });

function Lab() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const canRequest = role === "doctor" || role === "admin";
  const canResult = role === "lab_tech" || role === "admin" || role === "doctor";
  const [open, setOpen] = useState(false);
  const [resultFor, setResultFor] = useState<any>(null);

  const { data = [] } = useQuery({
    queryKey: ["lab"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lab_tests")
        .select("id, test_name, status, result, created_at, completed_at, patients(full_name), profiles:requested_by(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const submitResult = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: string }) => {
      const { error } = await supabase.from("lab_tests").update({
        result, status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Result recorded"); setResultFor(null); qc.invalidateQueries({ queryKey: ["lab"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); },
  });

  return (
    <PageShell>
      <PageHeader
        title="Laboratory"
        subtitle="Test requests, processing queue and results."
        action={
          canRequest && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><FlaskConical className="size-4 mr-2" /> Request test</Button>
              </DialogTrigger>
              <NewLab uid={user?.id} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["lab"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); }} />
            </Dialog>
          )
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left border-b border-border">
              <th className="px-4 py-2.5">Requested</th>
              <th className="px-4 py-2.5">Patient</th>
              <th className="px-4 py-2.5">Test</th>
              <th className="px-4 py-2.5">By Dr.</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Result</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No lab requests.</td></tr>}
            {data.map((t: any) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-mono text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{t.patients?.full_name}</td>
                <td className="px-4 py-3">{t.test_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.profiles?.full_name || "—"}</td>
                <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{t.result || "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canResult && t.status !== "completed" && (
                    <Button size="sm" variant="ghost" onClick={() => setResultFor(t)}>
                      <ClipboardCheck className="size-3.5 mr-1" /> Enter result
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resultFor && (
        <Dialog open={!!resultFor} onOpenChange={(o) => !o && setResultFor(null)}>
          <ResultDialog test={resultFor} onSubmit={(r) => submitResult.mutate({ id: resultFor.id, result: r })} pending={submitResult.isPending} />
        </Dialog>
      )}
    </PageShell>
  );
}

function NewLab({ uid, onDone }: { uid?: string; onDone: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [testName, setTestName] = useState("");
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data || [],
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!patientId || !testName) throw new Error("Patient & test name required");
      const { error } = await supabase.from("lab_tests").insert({ patient_id: patientId, test_name: testName, requested_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Test requested"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Request lab test</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Test name</Label>
          <Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. CBC, Lipid Panel, Urinalysis" />
        </div>
      </div>
      <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Sending…" : "Send to lab"}</Button></DialogFooter>
    </DialogContent>
  );
}

function ResultDialog({ test, onSubmit, pending }: { test: any; onSubmit: (r: string) => void; pending: boolean }) {
  const [r, setR] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Enter result — {test.test_name}</DialogTitle></DialogHeader>
      <div className="space-y-1.5">
        <Label>Result for {test.patients?.full_name}</Label>
        <textarea
          className="w-full min-h-[120px] rounded-md border border-input bg-background p-3 text-sm"
          value={r}
          onChange={e => setR(e.target.value)}
        />
      </div>
      <DialogFooter><Button onClick={() => onSubmit(r)} disabled={pending || !r}>{pending ? "Saving…" : "Submit result"}</Button></DialogFooter>
    </DialogContent>
  );
}
