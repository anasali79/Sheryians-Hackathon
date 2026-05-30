export const NOTIFICATION_TYPES = {
  invite_sent: { label: "Invite", color: "primary", icon: "📨" },
  invite_accepted: { label: "Joined", color: "success", icon: "✅" },
  incident_created: { label: "New", color: "new", icon: "🔥" },
  incident_assigned: { label: "Assigned", color: "ring", icon: "👤" },
  incident_resolved: { label: "Resolved", color: "success", icon: "✓" },
  responder_removed: { label: "Removed", color: "error", icon: "⛔" },
};

export const typeStyles = {
  invite_sent: "bg-primary/10 text-primary border-primary/20",
  invite_accepted: "bg-success/10 text-success border-success/20",
  incident_created: "bg-error/10 text-error border-error/20",
  incident_assigned: "bg-ring/10 text-ring border-ring/20",
  incident_resolved: "bg-success/10 text-success border-success/20",
  responder_removed: "bg-error/10 text-error border-error/20",
};

export const formatRelative = (iso) => {
  if (!iso) return "";
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const getTypeLabel = (type) => {
  return NOTIFICATION_TYPES[type]?.label || "Info";
};

export const getTypeIcon = (type) => {
  return NOTIFICATION_TYPES[type]?.icon || "📌";
};
