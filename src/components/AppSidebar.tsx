import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, FlaskConical, Pill, Receipt, LogOut, Activity,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/records", label: "Medical Records", icon: ClipboardList },
  { to: "/lab", label: "Laboratory", icon: FlaskConical },
  { to: "/pharmacy", label: "Pharmacy", icon: Pill },
  { to: "/billing", label: "Billing", icon: Receipt },
] as const;

const roleLabel: Record<string, string> = {
  admin: "System Admin",
  doctor: "Doctor",
  receptionist: "Receptionist",
  lab_tech: "Lab Technician",
  pharmacist: "Pharmacist",
};

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, fullName, role, user } = useAuth();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
        <div className="size-9 rounded-md bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
          <Activity className="size-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold leading-none">MediCore</div>
          <div className="text-mono text-[10px] text-muted-foreground tracking-wider mt-1">HOSPITAL OS</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2">Modules</div>
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={[
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              ].join(" ")}
            >
              <Icon className="size-4" />
              <span>{label}</span>
              {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-3">
        <div className="rounded-md bg-sidebar-accent/60 border border-sidebar-border p-3">
          <div className="text-sm font-medium truncate">{fullName || user?.email}</div>
          <div className="text-mono text-[10px] uppercase tracking-wider text-primary mt-1">
            {role ? roleLabel[role] : "—"}
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={() => signOut()}>
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
