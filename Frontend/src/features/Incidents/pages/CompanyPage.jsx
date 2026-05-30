import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useSelector } from "react-redux";
import {
  FiAlertCircle,
  FiCalendar,
  FiExternalLink,
  FiGrid,
  FiHash,
  FiShield,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { SiOpslevel } from "react-icons/si";
import Loader from "../../../shared/components/Loader";
import Button from "../../../shared/components/Button";
import { api } from "../../../api/httpClient";
import { canManageWorkspace } from "../../../lib/workspacePaths";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";

const formatDate = (iso) => {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PLAN_DETAILS = {
  FREE: {
    label: "Free",
    badgeClass: "bg-bg-muted text-text border-border",
    description: "Core incident management for small teams getting started.",
    features: [
      "Unlimited incidents in your workspace",
      "Team invites and role management",
      "Internal status page",
      "Incident timeline and assignments",
    ],
  },
  PRO: {
    label: "Pro",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    description: "Advanced operations with priority support and AI tooling.",
    features: [
      "Everything in Free",
      "AI-generated postmortems",
      "Priority email notifications",
      "Advanced workspace analytics",
    ],
  },
};

const StatCard = ({ label, value, sub, accent }) => (
  <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
      {label}
    </p>
    <p className={`text-3xl font-black ${accent || "text-text"}`}>{value}</p>
    {sub && <p className="text-xs text-text-muted mt-2 font-medium">{sub}</p>}
  </div>
);

const InfoRow = ({ label, value, mono }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-border/70 last:border-0">
    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
      {label}
    </span>
    <span
      className={`text-sm font-semibold text-text ${mono ? "font-mono text-xs break-all sm:text-right" : ""}`}>
      {value}
    </span>
  </div>
);

const CompanyPage = () => {
  const user = useSelector((state) => state.auth.user);
  const paths = useWorkspacePaths();
  const isPrivileged = canManageWorkspace(user?.role);

  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const res = await api.get("/company/overview");
        setOverview(res?.data || null);
      } catch (error) {
        setErrorMessage(error?.message || "Failed to load company details.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isPrivileged]);

  if (!isPrivileged) {
    return <Navigate to={paths.dashboard} replace />;
  }

  if (isLoading) return <Loader label="Loading company…" />;

  const company = overview?.company;
  const owner = overview?.owner;
  const stats = overview?.stats;
  const links = overview?.links;
  const planKey = company?.plan === "PRO" ? "PRO" : "FREE";
  const plan = PLAN_DETAILS[planKey];

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-4 sm:p-8 w-full min-h-0">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">
              Workspace
            </p>
            <h1 className="text-4xl font-bold text-text mb-2">Company</h1>
            <p className="text-text-muted text-md font-medium max-w-xl">
              Overview of your organization on MayDayOps: plan, team, and
              incident health in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={paths.team}>
              <Button variant="secondary" size="sm" className="font-bold">
                Manage team
              </Button>
            </Link>
            <Link to={paths.dashboard}>
              <Button variant="primary" size="sm" className="font-bold">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {errorMessage && (
          <p className="text-error text-sm font-medium mb-6">{errorMessage}</p>
        )}

        {company && (
          <>
            <div className="bg-bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <SiOpslevel className="text-3xl text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-text truncate">
                      {company.name}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${plan.badgeClass}`}>
                      {plan.label} plan
                    </span>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {plan.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <InfoRow label="Workspace slug" value={company.slug || "\u2014"} mono />
                <InfoRow label="Workspace ID" value={String(company.id)} mono />
                <InfoRow label="Created" value={formatDate(company.createdAt)} />
                <InfoRow label="Last updated" value={formatDate(company.updatedAt)} />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Team members"
                value={stats?.members?.total ?? 0}
                sub={`${stats?.members?.activeLast24h ?? 0} active in 24h`}
                accent="text-primary"
              />
              <StatCard
                label="Open incidents"
                value={stats?.incidents?.byStatus?.OPEN ?? 0}
                sub={`${stats?.incidents?.activeP1 ?? 0} active P1`}
                accent="text-error"
              />
              <StatCard
                label="Investigating"
                value={stats?.incidents?.byStatus?.INVESTIGATING ?? 0}
                sub="In progress now"
                accent="text-ring"
              />
              <StatCard
                label="Resolved"
                value={stats?.incidents?.byStatus?.RESOLVED ?? 0}
                sub={`${stats?.incidents?.total ?? 0} total`}
                accent="text-success"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FiShield className="text-primary" size={18} />
                  <h3 className="text-lg font-bold text-text">Plan and billing</h3>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-text-muted">
                      <FiZap className="text-primary shrink-0 mt-0.5" size={14} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-text-muted">
                  {planKey === "FREE"
                    ? "Upgrade to Pro for AI postmortems and advanced alerts."
                    : "Your workspace is on the Pro plan."}
                </p>
              </div>

              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FiUsers className="text-primary" size={18} />
                  <h3 className="text-lg font-bold text-text">Team breakdown</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(stats?.members?.byRole || {}).map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                      <span className="text-sm font-semibold text-text">{role}</span>
                      <span className="text-sm font-bold text-text-muted tabular-nums">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-4">
                  {stats?.pendingInvites ?? 0} pending invite
                  {(stats?.pendingInvites ?? 0) === 1 ? "" : "s"}
                </p>
                <Link
                  to={paths.team}
                  className="inline-block mt-3 text-sm font-bold text-primary hover:underline">
                  Open team management
                </Link>
              </div>

              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FiCalendar className="text-primary" size={18} />
                  <h3 className="text-lg font-bold text-text">Workspace owner</h3>
                </div>
                {owner ? (
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-text">{owner.name}</p>
                    <p className="text-sm text-text-muted">{owner.email}</p>
                    <p className="text-xs text-text-muted">
                      Role: {owner.role} &middot; Joined {formatDate(owner.memberSince)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No owner on record.</p>
                )}
              </div>

              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FiHash className="text-primary" size={18} />
                  <h3 className="text-lg font-bold text-text">Quick links</h3>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    to={paths.dashboard}
                    className="flex items-center gap-2 text-sm font-semibold text-text hover:text-primary transition-colors py-2">
                    <FiGrid size={16} /> Dashboard
                  </Link>
                  <Link
                    to={paths.incidents}
                    className="flex items-center gap-2 text-sm font-semibold text-text hover:text-primary transition-colors py-2">
                    <FiAlertCircle size={16} /> Incidents
                  </Link>
                  <Link
                    to={paths.status}
                    className="flex items-center gap-2 text-sm font-semibold text-text hover:text-primary transition-colors py-2">
                    <FiExternalLink size={16} /> Status page
                  </Link>
                  <Link
                    to={paths.team}
                    className="flex items-center gap-2 text-sm font-semibold text-text hover:text-primary transition-colors py-2">
                    <FiUsers size={16} /> Team management
                  </Link>
                </div>
                {links?.publicStatusApi && (
                  <p className="text-[10px] text-text-muted mt-4 font-mono break-all leading-relaxed">
                    Public API: {links.publicStatusApi}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyPage;
