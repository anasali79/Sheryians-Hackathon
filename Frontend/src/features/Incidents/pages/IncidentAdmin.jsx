import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import DeclareIncidentModal from "../components/DeclareIncidentModal";
import Button from "../../../shared/components/Button";
import Loader from "../../../shared/components/Loader";
import { api } from "../../../api/httpClient";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";
import { canManageWorkspace } from "../../../lib/workspacePaths";

const formatStatusLabel = (status = "") => {
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "RESOLVED") return "Resolved";
  return status;
};

const getIncidentDisplayId = (id = "") => `INC-${id.slice(-5).toUpperCase()}`;

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

const IncidentAdmin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const paths = useWorkspacePaths();
  const user = useSelector((state) => state.auth.user);
  const isPrivileged = canManageWorkspace(user?.role);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());

  const fetchIncidents = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await api.get("/incidents");
      setIncidents(response?.data?.incidents || []);
    } catch (error) {
      setErrorMessage(error?.message || "Failed to fetch incidents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filtersActive = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return Boolean(p.get("q")?.trim() || p.get("status")?.trim());
  }, [location.search]);

  const filteredIncidents = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("q")?.trim().toLowerCase();
    const status = params.get("status")?.trim().toUpperCase();

    let result = incidents;

    if (status) {
      result = result.filter((incident) => incident.status === status);
    }

    if (!query) return result;

    return result.filter((incident) => {
      const fields = [
        incident.title,
        incident.description,
        incident.status,
        incident.severity,
        getIncidentDisplayId(incident._id),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return fields.some((value) => value.includes(query));
    });
  }, [incidents, location.search]);

  if (isLoading) return <Loader />;

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-4 sm:p-8 w-full min-h-0">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-text">Active Incidents</h1>
        {isPrivileged && (
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            size="md"
            className="font-bold">
            + Create Incident
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-bg-surface border border-border rounded-lg flex flex-col shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-text mb-1">
              Active Incidents
            </h3>
            <p className="text-md font-medium text-text-muted">
              Monitoring real-time infrastructure anomalies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" className="font-bold">
              Filter
            </Button>
            <Button variant="secondary" size="md" className="font-bold">
              Export
            </Button>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border text-md font-bold text-text-muted uppercase">
            <div className="col-span-2">Status</div>
            <div className="col-span-6">Incident Title</div>
            <div className="col-span-2 text-center">Severity</div>
            <div className="col-span-2 text-right">Time Elapsed</div>
          </div>

          {/* Table Rows */}

          {!isLoading && errorMessage && (
            <div className="px-6 py-8 text-error text-lg">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && filteredIncidents.length === 0 && (
            <div className="px-6 py-8 text-text-muted text-lg">
              {filtersActive
                ? "No incidents match your filters."
                : "No incidents yet."}
            </div>
          )}

          {!isLoading && !errorMessage && filteredIncidents.length > 0 && (
            <div className="divide-y divide-border">
              {filteredIncidents.map((inc) => (
                <div
                  key={inc._id}
                  onClick={() => navigate(paths.incidentDetail(inc._id))}
                  className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-primary/5 cursor-pointer transition-colors">
                  <div className="col-span-2 flex items-center">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2 ${
                        inc.status === "INVESTIGATING"
                          ? "bg-ring/10 text-ring"
                          : inc.status === "OPEN"
                            ? "bg-error/10 text-error animate-pulse"
                            : "bg-success/10 text-success"
                      }`}>
                      {formatStatusLabel(inc.status)}
                    </span>
                  </div>

                  <div className="col-span-6">
                    <div className="text-md text-text-muted font-mono mb-1">
                      {getIncidentDisplayId(inc._id)}
                    </div>
                    <div className="text-lg font-bold text-text">
                      {inc.title}
                    </div>
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <span
                      className={`px-3 py-0.5 rounded-full border text-sm font-bold ${
                        inc.severity === "P1"
                          ? "border-error/30 bg-error/5 text-error"
                          : inc.severity === "P2"
                            ? "border-ring/30 bg-ring/5 text-ring"
                            : "border-success/30 bg-success/5 text-success"
                      }`}>
                      {inc.severity}
                    </span>
                  </div>

                  <div className="col-span-2 text-right text-lg text-text-muted font-mono">
                    {toElapsedTime(inc, nowTs)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isPrivileged && (
        <DeclareIncidentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onIncidentCreated={fetchIncidents}
        />
      )}
    </div>
  );
};

export default IncidentAdmin;
