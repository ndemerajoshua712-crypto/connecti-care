import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageShell } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/patients")({ component: Patients });

function Patients() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canCreate = role === "receptionist" || role === "admin";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = data.filter((p: any) =>
    p.full_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.phone || "").includes(q) ||
    (p.email || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <PageShell>
      <PageHeader
        title="Patient Registry"
        subtitle="Master record of every patient in the hospital."
        action={
          canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="size-4 mr-2" /> Register patient</Button>
              </DialogTrigger>
              <NewPatientDialog
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["patients"] });
                  qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
                }}
              />
            </Dialog>
          )
        }
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, phone or email…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <span className="text-mono text-xs text-muted-foreground">{filtered.length} records</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left border-b border-border">
              <th className="px-4 py-2.5">Patient ID</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Gender</th>
              <th className="px-4 py-2.5">DOB</th>
              <th className="px-4 py-2.5">Blood</th>
              <th className="px-4 py-2.5">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No patients found.</td></tr>
            )}
            {filtered.map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-mono text-xs text-muted-foreground">{p.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.gender || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.date_of_birth || "—"}</td>
                <td className="px-4 py-3 text-mono">{p.blood_type || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.phone || p.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function NewPatientDialog({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", gender: "", phone: "", email: "", address: "", blood_type: "",
  });
  const m = useMutation({
    mutationFn: async () => {
      if (!form.full_name) throw new Error("Name is required");
      const { error } = await supabase.from("patients").insert({
        ...form,
        date_of_birth: form.date_of_birth || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Patient registered"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Register new patient</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Full name *</Label>
          <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Date of birth</Label>
          <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Blood type</Label>
          <Select value={form.blood_type} onValueChange={v => setForm({ ...form, blood_type: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          <Plus className="size-4 mr-1" /> {m.isPending ? "Saving…" : "Create patient"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
