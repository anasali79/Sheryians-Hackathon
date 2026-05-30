import { useMemo } from "react";
import { useLocation } from "react-router";

/**
 * Resolves navigation paths so the same pages work under /admin/* and /{dashboard,incidents,...}.
 */
export function useWorkspacePaths() {
  const { pathname } = useLocation();

  const isAdminShell = useMemo(() => pathname.startsWith("/admin"), [pathname]);
  const base = isAdminShell ? "/admin" : "";

  const join = (segment) => {
    const s = segment.startsWith("/") ? segment.slice(1) : segment;
    return base ? `${base}/${s}` : `/${s}`;
  };

  return {
    isAdminShell,
    base,
    dashboard: join("dashboard"),
    incidents: join("incidents"),
    incidentDetail: (id) => join(`incidents/${id}`),
    team: join("team"),
    status: join("status"),
    company: join("company"),
  };
}
