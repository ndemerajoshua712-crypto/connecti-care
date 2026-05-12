import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-mono text-muted-foreground">Initializing system…</div>
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/login"} />;
}
