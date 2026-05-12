import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { signIn, signUp, session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPass, setSiPass] = useState("");
  // sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [suRole, setSuRole] = useState<AppRole>("receptionist");

  if (!loading && session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 grid-bg border-r border-border">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-mono text-sm tracking-wider text-muted-foreground">SYSTEM</div>
            <div className="font-semibold text-lg">MediCore HIS</div>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            One hospital,<br />
            <span className="text-primary">one source of truth.</span>
          </h1>
          <p className="text-muted-foreground">
            Reception, doctors, lab and pharmacy operate on a single live patient record — from arrival to billing.
          </p>
          <div className="grid grid-cols-3 gap-3 text-mono text-xs">
            {["REGISTER", "TREAT", "DISPENSE"].map(s => (
              <div key={s} className="rounded-md border border-border bg-card/50 p-3 text-center">
                <div className="text-primary">●</div>
                <div className="mt-1 text-muted-foreground">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-mono text-xs text-muted-foreground">v1.0 · COMMAND CENTER</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <Activity className="size-5 text-primary" />
            <span className="font-semibold">MediCore HIS</span>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">Work email</Label>
                <Input id="si-email" type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@hospital.org" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pass">Password</Label>
                <Input id="si-pass" type="password" value={siPass} onChange={e => setSiPass(e.target.value)} />
              </div>
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const { error } = await signIn(siEmail, siPass);
                  setBusy(false);
                  if (error) toast.error(error);
                  else { toast.success("Welcome back"); navigate({ to: "/dashboard" }); }
                }}
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">Full name</Label>
                <Input id="su-name" value={suName} onChange={e => setSuName(e.target.value)} placeholder="Dr. Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Work email</Label>
                <Input id="su-email" type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass">Password</Label>
                <Input id="su-pass" type="password" value={suPass} onChange={e => setSuPass(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department / Role</Label>
                <Select value={suRole} onValueChange={(v) => setSuRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receptionist">Receptionist / Admin desk</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="lab_tech">Lab technician</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                    <SelectItem value="admin">System admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  if (suPass.length < 6) return toast.error("Password must be 6+ characters");
                  setBusy(true);
                  const { error } = await signUp(suEmail, suPass, suName, suRole);
                  setBusy(false);
                  if (error) toast.error(error);
                  else { toast.success("Account created — signing you in"); navigate({ to: "/dashboard" }); }
                }}
              >
                {busy ? "Creating…" : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
