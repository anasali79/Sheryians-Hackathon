export const getIncidentDisplayId = (id = "") =>
  `INC-${String(id).slice(-5).toUpperCase()}`;

const formatStatusLabel = (status = "") => {
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "RESOLVED") return "Resolved";
  return status;
};

export const matchesQuery = (query, ...fields) => {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return fields
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
};

const matchesIncident = (incident, query) =>
  matchesQuery(
    query,
    incident.title,
    incident.description,
    incident.status,
    incident.severity,
    formatStatusLabel(incident.status),
    getIncidentDisplayId(incident._id),
  );

export const SEARCH_SECTION_META = {
  dashboard: {
    label: "Dashboard",
    description: "Overview, stats & shortcuts",
    headerClass: "bg-primary/10 text-primary border-primary/25",
    accentClass: "border-l-primary",
  },
  incidents: {
    label: "Incidents",
    description: "Tickets & incident details",
    headerClass: "bg-error/10 text-error border-error/25",
    accentClass: "border-l-error",
  },
  status: {
    label: "Status Page",
    description: "Live public status",
    headerClass: "bg-ring/10 text-ring border-ring/25",
    accentClass: "border-l-ring",
  },
  team: {
    label: "Team",
    description: "Members & invitations",
    headerClass: "bg-success/10 text-success border-success/25",
    accentClass: "border-l-success",
  },
  company: {
    label: "Company",
    description: "Plan, workspace & stats",
    headerClass: "bg-primary/10 text-primary border-primary/25",
    accentClass: "border-l-primary",
  },
};

const withSectionMeta = (id, items) => {
  const meta = SEARCH_SECTION_META[id] || {
    label: id,
    description: "",
    headerClass: "bg-bg-muted text-text-muted border-border",
    accentClass: "border-l-border",
  };
  return {
    id,
    label: meta.label,
    description: meta.description,
    headerClass: meta.headerClass,
    accentClass: meta.accentClass,
    items,
  };
};

/** Same ordering as dashboard incident table preview (top 10 by last update). */
export const getDashboardPreviewIncidents = (incidents = []) =>
  [...incidents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    )
    .slice(0, 10);

/**
 * @returns {{ id: string, label: string, items: { id: string, title: string, subtitle?: string, path: string }[] }[]}
 */
export function buildWorkspaceSearchResults({
  query,
  incidents = [],
  members = [],
  pendingInvites = [],
  paths,
  includeCompany = false,
}) {
  const q = query.trim();
  if (!q) return [];

  const sections = [];
  const dashboardPreview = getDashboardPreviewIncidents(incidents);

  const dashboardItems = [];
  const dashboardShortcuts = [
    {
      id: "dash-open",
      title: "Open",
      subtitle: "Open incidents on dashboard",
      path: `${paths.incidents}?status=OPEN`,
      match: ["open", "dashboard", "tickets"],
    },
    {
      id: "dash-investigating",
      title: "Investigating",
      subtitle: "Active investigations",
      path: `${paths.incidents}?status=INVESTIGATING`,
      match: ["investigating", "investigation", "active"],
    },
    {
      id: "dash-resolved",
      title: "Resolved",
      subtitle: "Resolved incidents",
      path: `${paths.incidents}?status=RESOLVED`,
      match: ["resolved", "closed"],
    },
    {
      id: "dash-team",
      title: "Team Members",
      subtitle: "Team size on dashboard",
      path: paths.team,
      match: ["team", "members", "people"],
    },
    {
      id: "dash-incidents",
      title: "Incidents",
      subtitle: "Dashboard incidents table",
      path: paths.incidents,
      match: ["incidents", "view all", "table"],
    },
    {
      id: "dash-home",
      title: "Dashboard",
      subtitle: "Workspace overview",
      path: paths.dashboard,
      match: ["dashboard", "welcome", "home", "overview"],
    },
  ];

  for (const item of dashboardShortcuts) {
    if (matchesQuery(q, item.title, item.subtitle, ...item.match)) {
      dashboardItems.push({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        path: item.path,
      });
    }
  }

  dashboardPreview
    .filter((inc) => matchesIncident(inc, q))
    .forEach((inc) => {
      dashboardItems.push({
        id: `dash-inc-${inc._id}`,
        title: inc.title,
        subtitle: `${getIncidentDisplayId(inc._id)} · ${inc.severity} · ${formatStatusLabel(inc.status)}`,
        path: paths.incidentDetail(inc._id),
      });
    });

  if (dashboardItems.length > 0) {
    sections.push(withSectionMeta("dashboard", dashboardItems.slice(0, 8)));
  }

  const incidentItems = incidents
    .filter((inc) => matchesIncident(inc, q))
    .slice(0, 8)
    .map((inc) => ({
      id: `inc-${inc._id}`,
      title: inc.title,
      subtitle: `${getIncidentDisplayId(inc._id)} · ${formatStatusLabel(inc.status)} · ${inc.severity}`,
      path: paths.incidentDetail(inc._id),
    }));

  if (incidentItems.length > 0) {
    sections.push(withSectionMeta("incidents", incidentItems));
  }

  const statusItems = [];
  if (
    matchesQuery(
      q,
      "status page",
      "status",
      "operational",
      "systems",
      "live incident",
    )
  ) {
    statusItems.push({
      id: "status-page",
      title: "Status Page",
      subtitle: "Live incident status for your organization",
      path: paths.status,
    });
  }

  incidents
    .filter((inc) => inc.status !== "RESOLVED" && matchesIncident(inc, q))
    .slice(0, 6)
    .forEach((inc) => {
      statusItems.push({
        id: `status-inc-${inc._id}`,
        title: inc.title,
        subtitle: `${inc.severity} · ${formatStatusLabel(inc.status)}`,
        path: paths.status,
      });
    });

  if (statusItems.length > 0) {
    sections.push(withSectionMeta("status", statusItems.slice(0, 8)));
  }

  const teamItems = [];
  if (
    matchesQuery(
      q,
      "team",
      "team management",
      "members",
      "invite",
      "invitation",
      "pending",
    )
  ) {
    teamItems.push({
      id: "team-page",
      title: "Team Management",
      subtitle: "Manage members and pending invitations",
      path: paths.team,
    });
  }

  members
    .filter((member) =>
      matchesQuery(q, member.name, member.email, member.role),
    )
    .slice(0, 6)
    .forEach((member) => {
      teamItems.push({
        id: `mem-${member._id}`,
        title: member.name || member.email,
        subtitle: `${member.email} · ${member.role}`,
        path: paths.team,
      });
    });

  pendingInvites
    .filter((invite) => matchesQuery(q, invite.email, invite.status, "pending"))
    .forEach((invite) => {
      teamItems.push({
        id: `inv-${invite._id}`,
        title: invite.email,
        subtitle: `Pending invite · ${invite.status || "PENDING"}`,
        path: paths.team,
      });
    });

  if (teamItems.length > 0) {
    sections.push(withSectionMeta("team", teamItems.slice(0, 8)));
  }

  if (includeCompany && paths?.company) {
    const companyItems = [];
    if (
      matchesQuery(
        q,
        "company",
        "workspace",
        "organization",
        "plan",
        "billing",
        "pro",
        "free",
        "overview",
        "slug",
      )
    ) {
      companyItems.push({
        id: "company-page",
        title: "Company",
        subtitle: "Workspace plan, stats & details",
        path: paths.company,
      });
    }
    if (companyItems.length > 0) {
      sections.push(withSectionMeta("company", companyItems));
    }
  }

  return sections;
}
