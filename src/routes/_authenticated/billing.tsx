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
import { Receipt, Plus, Trash2, BadgeDollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/billing")({ component: Billing });

type Item = { description: string; amount: number };

function Billing() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canBill = role === "receptionist" || role === "admin";
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id, items, total, status, created_at, patients(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked paid"); qc.invalidateQueries({ queryKey: ["bills"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); },
  });

  return (
    <PageShell>
      <PageHeader
        title="Billing"
        subtitle="Invoices generated automatically from services rendered."
        action={
          canBill && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Receipt className="size-4 mr-2" /> New invoice</Button>
              </DialogTrigger>
              <NewBill onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["bills"] }); qc.invalidateQueries({ queryKey: ["dashboard-counts"] }); }} />
            </Dialog>
          )
        }
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            No invoices yet.
          </div>
        )}
        {data.map((b: any) => (
          <div key={b.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">Invoice {b.id.slice(0, 8).toUpperCase()}</div>
                <div className="font-semibold mt-1">{b.patients?.full_name}</div>
              </div>
              <StatusPill status={b.status} />
            </div>
            <div className="space-y-1 text-sm">
              {(b.items || []).map((it: Item, i: number) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span className="truncate">{it.description}</span>
                  <span className="text-mono">${Number(it.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</div>
              <div className="text-mono font-bold text-lg">${Number(b.total).toFixed(2)}</div>
            </div>
            {b.status !== "paid" && canBill && (
              <Button className="w-full mt-3" size="sm" variant="secondary" onClick={() => markPaid.mutate(b.id)}>
                <BadgeDollarSign className="size-3.5 mr-1" /> Mark as paid
              </Button>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function NewBill({ onDone }: { onDone: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "Consultation", amount: 50 }]);
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data || [],
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!patientId || items.length === 0) throw new Error("Patient & at least one item required");
      const { error } = await supabase.from("bills").insert({
        patient_id: patientId, items: items as any, total,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Line items</Label>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Description"
                value={it.description}
                onChange={e => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
              />
              <Input
                type="number" className="w-28" placeholder="0.00"
                value={it.amount}
                onChange={e => setItems(items.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: "", amount: 0 }])}>
            <Plus className="size-3.5 mr-1" /> Add item
          </Button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-mono text-xs uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-mono font-bold text-xl">${total.toFixed(2)}</div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Create invoice"}</Button></DialogFooter>
    </DialogContent>
  );
}
