import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import Loader from "../../../shared/components/Loader";
import { api } from "../../../api/httpClient";

const formatStatusLabel = (status = "") => {
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "RESOLVED") return "Resolved";
  return status;
};

const formatRelative = (iso) => {
  if (!iso) return "";
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const IncidentStatusPage = () => {
  const user = useSelector((state) => state.auth.user);
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const companyName =
    user?.companyId?.name || user?.company?.name || "Your workspace";

  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const res = await api.get("/incidents");
      setIncidents(res?.data?.incidents || []);
    } catch (error) {
      setErrorMessage(error?.message || "Failed to load status.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.status !== "RESOLVED"),
    [incidents],
  );

  const sortedActive = useMemo(() => {
    const order = { P1: 1, P2: 2, P3: 3 };
    return [...activeIncidents].sort((a, b) => {
      const s = (order[a.severity] || 9) - (order[b.severity] || 9);
      if (s !== 0) return s;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }, [activeIncidents]);

  const systemBanner = useMemo(() => {
    if (activeIncidents.length === 0) {
      return {
        text: "All systems operational",
        bg: "bg-success/10",
        border: "border-success/20",
        fg: "text-success",
      };
    }
    if (activeIncidents.some((i) => i.severity === "P1")) {
      return {
        text: "Critical — P1 incident in progress",
        bg: "bg-error/10",
        border: "border-error/20",
        fg: "text-error",
      };
    }
    if (activeIncidents.some((i) => i.status === "OPEN")) {
      return {
        text: "Service disruption — open incidents",
        bg: "bg-error/10",
        border: "border-error/20",
        fg: "text-error",
      };
    }
    return {
      text: "Investigating — no open tickets",
      bg: "bg-ring/10",
      border: "border-ring/20",
      fg: "text-ring",
    };
  }, [activeIncidents]);

  const severityBadgeClass = (sev) => {
    if (sev === "P1") return "border-error/30 bg-error/5 text-error";
    if (sev === "P2") return "border-ring/30 bg-ring/5 text-ring";
    return "border-success/30 bg-success/5 text-success";
  };

  const statusTextClass = (inc) => {
    if (inc.status === "RESOLVED") return "text-success";
    if (inc.status === "INVESTIGATING") return "text-ring";
    return "text-error";
  };

  if (isLoading) return <Loader />;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg overflow-y-auto">
      <div className="h-20 border-b border-border flex items-center px-8 shrink-0 bg-bg">
        <h1 className="text-xl font-bold text-text">Status Page</h1>
      </div>

      <div className="flex-1 flex flex-col items-center py-12 px-4">
        {errorMessage && (
          <p className="text-error text-sm font-medium mb-4 max-w-3xl w-full text-center">
            {errorMessage}
          </p>
        )}

        <div
          className={`${systemBanner.bg} ${systemBanner.border} border rounded-full px-4 py-1.5 flex items-center gap-2 mb-6`}>
          <span className={`${systemBanner.fg} font-bold text-xl`}>
            {systemBanner.text}
          </span>
        </div>

        <h1 className="text-4xl font-bold text-text mb-2 text-center">
          {companyName}
        </h1>
        <p className="text-text-muted text-xl mb-12 text-center max-w-2xl">
          Live incident status for your organization. Open and investigating
          items are shown below.
        </p>

        <div className="w-full max-w-3xl flex flex-col gap-3 mb-12">
          {!isLoading && sortedActive.length === 0 && (
            <div className="bg-bg-surface border border-border rounded-lg p-8 text-center text-text-muted shadow-sm">
              No active incidents. All monitored systems are clear.
            </div>
          )}
          {!isLoading &&
            sortedActive.map((inc) => (
              <div
                key={inc._id}
                className="bg-bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className={`px-2.5 py-1 rounded-md border text-xs font-bold shrink-0 mt-0.5 ${severityBadgeClass(inc.severity)}`}>
                    {inc.severity}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-text font-bold text-lg mb-1 wrap-break-word">
                      {inc.title}
                    </h4>
                    <p className="text-text-muted text-md font-medium line-clamp-2">
                      {inc.description || "No description provided."}
                    </p>
                    <p className="text-sm text-text-muted/80 mt-2">
                      Updated {formatRelative(inc.updatedAt || inc.createdAt)}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 shrink-0 ${statusTextClass(inc)}`}>
                  <span className="text-lg font-bold">
                    {formatStatusLabel(inc.status)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        <div className="w-full max-w-3xl">
          <h3 className="text-md font-bold text-text-muted uppercase mb-4">
            Summary
          </h3>
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm text-text-muted text-md space-y-2">
            <p>
              <span className="font-bold text-text">
                {activeIncidents.length}
              </span>{" "}
              active incident
              {activeIncidents.length === 1 ? "" : "s"}
            </p>
            <p>
              <span className="font-bold text-text">
                {incidents.filter((i) => i.status === "RESOLVED").length}
              </span>{" "}
              resolved (total in workspace)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentStatusPage;
