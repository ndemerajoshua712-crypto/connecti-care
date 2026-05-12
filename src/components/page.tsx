import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <div className="text-mono text-[11px] tracking-widest text-muted-foreground uppercase">// {title.split(" ")[0]}</div>
        <h1 className="text-2xl font-bold mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-accent/15 text-accent border-accent/40",
    completed: "bg-success/15 text-success border-success/40",
    cancelled: "bg-destructive/15 text-destructive border-destructive/40",
    requested: "bg-warning/15 text-warning border-warning/40",
    pending: "bg-warning/15 text-warning border-warning/40",
    in_progress: "bg-accent/15 text-accent border-accent/40",
    dispensed: "bg-success/15 text-success border-success/40",
    paid: "bg-success/15 text-success border-success/40",
    unpaid: "bg-warning/15 text-warning border-warning/40",
  };
  const cls = map[status] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-mono text-[10px] uppercase tracking-wider ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status.replace("_", " ")}
    </span>
  );
}
