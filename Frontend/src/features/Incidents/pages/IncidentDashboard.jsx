import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowUp, FiArrowDown, FiArrowRight } from "react-icons/fi";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import DeclareIncidentModal from "../components/DeclareIncidentModal";
import Button from "../../../shared/components/Button";
import Loader from "../../../shared/components/Loader";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";
import { canManageWorkspace } from "../../../lib/workspacePaths";
import { api } from "../../../api/httpClient";

const formatStatusLabel = (status = "") => {
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "RESOLVED") return "Resolved";
  return status;
};

const getIncidentDisplayId = (id = "") =>
  `INC-${String(id).slice(-5).toUpperCase()}`;

const toElapsedTime = (incident, nowTs) => {
  if (!incident?.createdAt) return "--";
  const startTs = new Date(incident.createdAt).getTime();
  const endTs =
    incident.status === "RESOLVED" && incident.resolvedAt
      ? new Date(incident.resolvedAt).getTime()
      : nowTs;
  const diffMs = Math.max(0, endTs - startTs);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    "0",
  );
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const formatRelative = (iso) => {
  if (!iso) return "";
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const IncidentDashboard = () => {
  const navigate = useNavigate();
  const paths = useWorkspacePaths();
  const user = useSelector((state) => state.auth.user);
  const isPrivileged = canManageWorkspace(user?.role);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const [incRes, memRes] = await Promise.all([
        api.get("/incidents"),
        api.get("/company/members").catch(() => ({ data: { members: [] } })),
      ]);
      setIncidents(incRes?.data?.incidents || []);
      setMembers(memRes?.data?.members || []);
    } catch (error) {
      setErrorMessage(error?.message || "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const open = incidents.filter((i) => i.status === "OPEN").length;
    const investigating = incidents.filter(
      (i) => i.status === "INVESTIGATING",
    ).length;
    const resolved = incidents.filter((i) => i.status === "RESOLVED").length;

    const dayAgo = Date.now() - 86400000;
    const openNew24h = incidents.filter(
      (i) => i.status === "OPEN" && new Date(i.createdAt).getTime() > dayAgo,
    ).length;

    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentResolved = incidents.filter(
      (i) =>
        i.status === "RESOLVED" &&
        i.resolvedAt &&
        new Date(i.resolvedAt).getTime() >= thirtyDaysAgo,
    );
    const mttrMs = recentResolved.map(
      (i) => new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime(),
    );
    const avgMttrMin = mttrMs.length
      ? Math.round(mttrMs.reduce((a, b) => a + b, 0) / mttrMs.length / 60000)
      : 0;

    const investigatingList = incidents.filter(
      (i) => i.status === "INVESTIGATING",
    );
    const oldestInv = investigatingList.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    )[0];

    const oneDayAgo = Date.now() - 86400000;
    const recentlyActiveMembers = members.filter(
      (m) => m.lastLogin && new Date(m.lastLogin).getTime() > oneDayAgo,
    ).length;

    return {
      open,
      investigating,
      resolved,
      openNew24h,
      avgMttrMin,
      oldestInvestigating: oldestInv,
      memberCount: members.length,
      recentlyActiveMembers,
    };
  }, [incidents, members]);

  /** Open + investigating + recently resolved (sorted by last update). */
  const tableIncidentsPreview = useMemo(() => {
    return [...incidents]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt),
      )
      .slice(0, 10);
  }, [incidents]);

  const recentIncidentsFeed = useMemo(() => {
    return [...incidents]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt),
      )
      .slice(0, 6);
  }, [incidents]);

  const companyName =
    user?.companyId?.name || user?.company?.name || "your workspace";
  const displayName = user?.name || "there";
  const cardBaseClass =
    "bg-bg-surface border border-border rounded-lg p-6 flex flex-col gap-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors";

  const goToStatusFilter = (status) => {
    navigate(`${paths.incidents}?status=${encodeURIComponent(status)}`);
  };

  if (isLoading) return <Loader />;

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-4 sm:p-8 w-full min-h-0">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-5xl font-bold text-primary">Dashboard</h1>
        {isPrivileged && (
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            size="md"
            className="font-bold flex items-center justify-center gap-2">
            Create Incident
          </Button>
        )}
      </div>

      {errorMessage && (
        <p className="text-error text-sm font-medium mb-4">{errorMessage}</p>
      )}

      <div className="mb-8">
        <h2 className="text-4xl font-bold text-text mb-2">
          Welcome {displayName} 
        </h2>
        <p className="text-text-muted text-md font-medium">
          Here&apos;s what&apos;s happening with {companyName} today
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <button
          type="button"
          onClick={() => goToStatusFilter("OPEN")}
          className={cardBaseClass}>
          <span className="text-md font-extrabold text-text-muted uppercase">
            Open
          </span>
          <div>
            <div className="text-5xl font-black text-error mb-3">
              {isLoading ? "—" : stats.open}
            </div>
            <div className="flex items-center text-md text-text-muted font-medium gap-1">
              <FiArrowUp className="text-primary" size={20} />
              <span className="text-primary">{stats.openNew24h}</span>
              <span>opened in last 24h</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToStatusFilter("INVESTIGATING")}
          className={cardBaseClass}>
          <span className="text-md font-extrabold text-text-muted uppercase">
            Investigating
          </span>
          <div>
            <div className="text-5xl font-black text-ring mb-3">
              {isLoading ? "—" : stats.investigating}
            </div>
            <div className="text-md text-text-muted font-medium">
              {stats.oldestInvestigating
                ? `Oldest active: ${formatRelative(stats.oldestInvestigating.createdAt)}`
                : "No active investigations"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToStatusFilter("RESOLVED")}
          className={cardBaseClass}>
          <span className="text-md font-extrabold text-text-muted uppercase">
            Resolved
          </span>
          <div>
            <div className="text-5xl font-black text-success mb-3">
              {isLoading ? "—" : stats.resolved}
            </div>
            <div className="flex items-center text-md text-text-muted font-medium gap-1">
              <FiArrowDown className="text-success" size={20} />
              <span>
                Avg MTTR{" "}
                {stats.avgMttrMin > 0 ? `${stats.avgMttrMin} min` : "—"} (30d
                resolved)
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate(paths.team)}
          className={cardBaseClass}>
          <span className="text-md font-extrabold text-text-muted uppercase">
            Team Members
          </span>
          <div>
            <div className="text-5xl font-black text-primary mb-3">
              {isLoading ? "—" : stats.memberCount}
            </div>
            <div className="text-md text-text-muted font-medium">
              {stats.recentlyActiveMembers} logged in last 24h
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-bg border border-border rounded-lg flex flex-col shadow-sm">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-xl font-bold text-text">Incidents</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(paths.incidents)}
              className="font-bold flex items-center gap-1.5 cursor-pointer">
              View all <FiArrowRight />
            </Button>
          </div>

          <div className="p-0 overflow-x-auto">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border text-md font-bold text-text-muted uppercase">
              <div className="col-span-6">Incident</div>
              <div className="col-span-2 text-center">Severity</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-right">Time</div>
            </div>

            <div className="divide-y divide-border">
              {!isLoading && tableIncidentsPreview.length === 0 && (
                <div className="px-6 py-8 text-text-muted">
                  No incidents yet.
                </div>
              )}
              {!isLoading &&
                tableIncidentsPreview.map((inc) => (
                  <div
                    key={inc._id}
                    onClick={() => navigate(paths.incidentDetail(inc._id))}
                    className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-primary/10 cursor-pointer">
                    <div className="col-span-6">
                      <div className="text-sm text-text-muted font-mono mb-1">
                        {getIncidentDisplayId(inc._id)}
                      </div>
                      <div className="text-md font-bold text-text">
                        {inc.title}
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-sm font-bold ${
                          inc.severity === "P1"
                            ? "border-error/30 bg-error/5 text-error"
                            : inc.severity === "P2"
                              ? "border-ring/30 bg-ring/5 text-ring"
                              : "border-success/30 bg-success/5 text-success"
                        }`}>
                        {inc.severity}
                      </span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`px-3 py-1 rounded-lg text-md font-bold flex items-center gap-1.5 ${
                          inc.status === "RESOLVED"
                            ? "bg-success/10 text-success"
                            : inc.status === "INVESTIGATING"
                              ? "bg-ring/10 text-ring"
                              : "bg-error/10 text-error"
                        }`}>
                        {inc.status === "INVESTIGATING" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-ring animate-pulse" />
                        )}
                        {formatStatusLabel(inc.status)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-md text-text-muted font-mono">
                      {toElapsedTime(inc, nowTs)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="bg-bg-surface border border-border rounded-2xl flex flex-col shadow-sm">
          <div className="p-6 border-b border-border">
            <h3 className="text-xl font-bold text-text">Recent incidents</h3>
            <p className="text-sm text-text-muted mt-1">
              Latest updates across your workspace
            </p>
          </div>
          <div className="p-6 flex flex-col gap-6">
            {!isLoading && recentIncidentsFeed.length === 0 && (
              <div className="text-text-muted">No incidents yet.</div>
            )}
            {!isLoading &&
              recentIncidentsFeed.map((inc) => (
                <button
                  key={inc._id}
                  type="button"
                  onClick={() => navigate(paths.incidentDetail(inc._id))}
                  className="flex gap-4 text-left w-full rounded-lg hover:bg-bg-muted/50 p-1 -m-1 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="text-primary text-xs font-bold">
                      {(inc.title || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg text-text-muted leading-snug mb-1">
                      <span className="text-text font-bold">{inc.title}</span>
                      <span className="text-text-muted">
                        {" "}
                        · {formatStatusLabel(inc.status)}
                      </span>
                      <span className="text-text-muted"> · {inc.severity}</span>
                    </p>
                    <span className="text-sm text-text-muted font-medium">
                      Updated {formatRelative(inc.updatedAt || inc.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
      {isPrivileged && (
        <DeclareIncidentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onIncidentCreated={fetchDashboard}
        />
      )}
    </div>
  );
};

export default IncidentDashboard;
