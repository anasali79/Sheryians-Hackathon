import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { GoStopwatch } from "react-icons/go";
import { IoCloseCircle } from "react-icons/io5";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import Loader from "../../../shared/components/Loader";
import { io } from "socket.io-client";
import Button from "../../../shared/components/Button";
import { api } from "../../../api/httpClient";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";
import { canManageWorkspace } from "../../../lib/workspacePaths";
import { getSocketBaseUrl } from "../../../lib/socketBaseUrl";
import { getTeamTagLabel } from "../../../lib/teamTags";
import AssignMemberPicker from "../components/AssignMemberPicker";

const formatStatusLabel = (status = "") => {
  if (status === "OPEN") return "Open";
  if (status === "INVESTIGATING") return "Investigating";
  if (status === "RESOLVED") return "Resolved";
  return status;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  return new Date(value).toLocaleString();
};

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

const sortTimelineAsc = (entries) =>
  [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const mergeTimelineEntry = (prev, evt) => {
  if (!evt?._id) return prev;
  if (prev.some((e) => String(e._id) === String(evt._id))) return prev;
  return sortTimelineAsc([...prev, evt]);
};

const normalizeActionItems = (actionItems) => {
  if (Array.isArray(actionItems)) return actionItems;
  if (typeof actionItems !== "string") return [];

  return actionItems
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\d+\.\s*/, ""));
};

const IncidentDetails = () => {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);
  const paths = useWorkspacePaths();
  const isPrivileged = canManageWorkspace(user?.role);
  const [incident, setIncident] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [postmortem, setPostmortem] = useState(null);
  const [companyMembers, setCompanyMembers] = useState([]);
  const [selectedResponderId, setSelectedResponderId] = useState("");
  const [timelineMessage, setTimelineMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPostingTimeline, setIsPostingTimeline] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingPostmortem, setIsGeneratingPostmortem] = useState(false);
  const [isAssigningResponder, setIsAssigningResponder] = useState(false);
  const [removingResponderId, setRemovingResponderId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchIncidentDetails = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [incidentRes, timelineRes] = await Promise.all([
        api.get(`/incidents/${id}`),
        api.get(`/timeline/${id}`),
      ]);

      setIncident(incidentRes?.data?.incident || null);
      setTimeline(timelineRes?.data?.timeline || []);

      try {
        const postmortemRes = await api.get(`/incidents/${id}/postmortem`);
        setPostmortem(postmortemRes?.data?.postmortem || null);
      } catch {
        setPostmortem(null);
      }

      try {
        const membersRes = await api.get("/company/members");
        setCompanyMembers(membersRes?.data?.members || []);
      } catch {
        setCompanyMembers([]);
      }
    } catch (error) {
      setErrorMessage(error?.message || "Failed to fetch incident details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchIncidentDetails();
    }
  }, [id]);

  const canPostTimeline = useMemo(() => {
    if (!user || !incident) return false;
    if (canManageWorkspace(user.role)) return true;
    const uid = String(user._id ?? user.id ?? "");
    const assignedIds = (incident.assignedUsers || []).map((entry) =>
      typeof entry === "object" && entry?._id != null
        ? String(entry._id)
        : String(entry),
    );
    return Boolean(uid && assignedIds.includes(uid));
  }, [user, incident]);

  const appendTimelineFromSocket = useCallback(
    (evt) => {
      const incidentMatch =
        evt?.incidentId != null &&
        id != null &&
        String(evt.incidentId) === String(id);
      if (!incidentMatch) return;
      setTimeline((prev) => mergeTimelineEntry(prev, evt));
    },
    [id],
  );

  useEffect(() => {
    if (!id) return;

    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.emit("join:incident", id);
    socket.on("timeline:new", appendTimelineFromSocket);

    return () => {
      socket.emit("leave:incident", id);
      socket.off("timeline:new", appendTimelineFromSocket);
      socket.disconnect();
    };
  }, [id, appendTimelineFromSocket]);

  const assignedResponderIds = useMemo(() => {
    if (!incident) return [];
    return (incident.assignedUsers || []).map((entry) =>
      typeof entry === "object" && entry?._id != null
        ? String(entry._id)
        : String(entry),
    );
  }, [incident]);

  const responderList = useMemo(() => {
    if (!incident) return [];
    return (incident.assignedUsers || []).filter((u) => u?._id);
  }, [incident]);

  const handleStatusUpdate = async (status) => {
    if (!incident || status === incident.status) return;
    try {
      setIsUpdatingStatus(true);
      const response = await api.patch(`/incidents/${id}/status`, { status });
      setIncident(response?.data?.incident || incident);
      toast.success("Incident status updated");
    } catch (error) {
      toast.error(error?.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePostTimeline = async () => {
    const trimmed = timelineMessage.trim();
    if (!trimmed || !canPostTimeline) return;

    try {
      setIsPostingTimeline(true);
      const res = await api.post(`/timeline/${id}`, { message: trimmed });
      setTimelineMessage("");
      const evt = res?.data?.timeline;
      if (evt) {
        setTimeline((prev) => mergeTimelineEntry(prev, evt));
      } else {
        await fetchIncidentDetails();
      }
      toast.success("Timeline updated");
    } catch (error) {
      toast.error(error?.message || "Failed to post timeline update");
    } finally {
      setIsPostingTimeline(false);
    }
  };

  const handleGeneratePostmortem = async () => {
    try {
      setIsGeneratingPostmortem(true);
      const response = await api.post(`/incidents/${id}/postmortem`);
      setPostmortem(response?.data?.postmortem || null);
      toast.success("Postmortem generated");
    } catch (error) {
      toast.error(error?.message || "Failed to generate postmortem");
    } finally {
      setIsGeneratingPostmortem(false);
    }
  };

  const handleAssignResponder = async () => {
    if (!selectedResponderId) {
      toast.error("Please select a responder");
      return;
    }

    const existingUserIds = (incident?.assignedUsers || [])
      .map((member) => member?._id)
      .filter(Boolean);

    if (existingUserIds.includes(selectedResponderId)) {
      toast.error("This responder is already assigned");
      return;
    }

    try {
      setIsAssigningResponder(true);
      await api.post(`/incidents/${id}/assign`, {
        userIds: [...existingUserIds, selectedResponderId],
      });
      setSelectedResponderId("");
      await fetchIncidentDetails();
      toast.success("Responder assigned. Assignment email sent.");
    } catch (error) {
      toast.error(error?.message || "Failed to assign responder");
    } finally {
      setIsAssigningResponder(false);
    }
  };

  const handleRemoveResponder = async (responderId) => {
    if (!responderId || !incident) return;

    const currentUserId = String(user?._id ?? user?.id ?? "");
    if (responderId === currentUserId) {
      toast.error("You cannot remove yourself from the incident");
      return;
    }

    const existingUserIds = (incident.assignedUsers || [])
      .map((member) => member?._id)
      .filter(Boolean);

    const updatedUserIds = existingUserIds.filter(
      (uid) => String(uid) !== String(responderId)
    );

    if (updatedUserIds.length === existingUserIds.length) {
      toast.error("Responder not found in this incident");
      return;
    }

    try {
      setRemovingResponderId(responderId);
      await api.post(`/incidents/${id}/assign`, {
        userIds: updatedUserIds,
      });
      await fetchIncidentDetails();
      toast.success("Responder removed from incident");
    } catch (error) {
      toast.error(error?.message || "Failed to remove responder");
    } finally {
      setRemovingResponderId(null);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (errorMessage || !incident) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-8 w-full h-full">
        <Link
          to={paths.incidents}
          className="px-3 py-1.5 rounded-lg border border-border text-sm font-bold text-text-muted hover:text-text hover:bg-bg-surface transition-colors inline-flex items-center gap-2 mb-6">
          ← Back
        </Link>
        <p className="text-error text-lg">
          {errorMessage || "Incident not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg p-8 w-full h-full">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={paths.incidents}
          className="px-3 py-1.5 rounded-lg border border-border text-sm font-bold text-text-muted hover:text-text hover:bg-bg-surface transition-colors flex items-center gap-2">
          ← Back
        </Link>
        <span className="text-lg font-bold text-text-muted">{id}</span>
      </div>

      {/* Header Info */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text mb-4">{incident.title}</h1>
        <div className="flex items-center gap-3">
          <span
            className={`px-4 py-2 rounded-lg border text-sm font-bold ${
              incident.severity === "P1"
                ? "border-error/30 bg-error/5 text-error"
                : incident.severity === "P2"
                  ? "border-ring/30 bg-ring/5 text-ring"
                  : "border-success/30 bg-success/5 text-success"
            }`}>
            {incident.severity}
          </span>
          <span
            className={`px-3 py-1 rounded-lg text-md font-bold flex items-center gap-1.5 ${
              incident.status === "INVESTIGATING"
                ? "bg-ring/10 text-ring"
                : incident.status === "OPEN"
                  ? "bg-error/10 text-error"
                  : "bg-success/10 text-success"
            }`}>
            {formatStatusLabel(incident.status)}
          </span>
          <span className="text-lg text-text-muted font-mono flex items-center gap-2">
            <GoStopwatch className="inline-block" size={20} />{" "}
            {toElapsedTime(incident, nowTs)} elapsed
          </span>

          {isPrivileged && (
            <select
              value={incident.status}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              disabled={isUpdatingStatus}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm font-bold text-text focus:outline-none focus:border-primary transition-colors appearance-none ml-2">
              <option value="INVESTIGATING">Investigating</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          )}
        </div>
      </div>

      {/* Description Box */}
      <div className="bg-bg-surface border border-border rounded-lg p-5 mb-8 shadow-sm">
        <p className="text-md text-text font-medium leading-relaxed">
          {incident.description}
        </p>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Timeline */}
        <div className="lg:col-span-2">
          <h3 className="text-xl font-bold text-primary  mb-6 border-b border-border pb-2">
            Live Timeline
          </h3>

          <div className="flex flex-col gap-6 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5before:bg-border mb-8">
            {timeline.map((entry) => {
              const name = entry?.postedBy?.name || "Unknown";
              const initials = name.charAt(0).toUpperCase();
              return (
                <div key={entry._id} className="relative pl-12">
                  <div className="absolute left-0 w-8 h-8 rounded-full border-2 border-bg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-primary/20 z-10">
                    {initials}
                  </div>
                  <div className="bg-bg-surface border border-border rounded-lg p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-text">
                        {name}
                      </span>
                    </div>
                    <p className="text-md text-text-muted mb-2">
                      {entry.message}
                    </p>
                    <span className="text-sm text-text-muted/70 font-mono">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}

            {timeline.length === 0 && (
              <div className="text-text-muted text-md pl-1">
                No timeline updates yet.
              </div>
            )}
          </div>

          {/* New Post Input */}
          <div className="relative">
            {!canPostTimeline && (
              <p className="text-sm text-text-muted mb-2">
                Only admins or responders assigned to this incident can post
                timeline updates.
              </p>
            )}
            <input
              value={timelineMessage}
              onChange={(e) => setTimelineMessage(e.target.value)}
              type="text"
              disabled={!canPostTimeline}
              placeholder={
                canPostTimeline
                  ? "Post an update to the timeline..."
                  : "Assign yourself as a responder to post updates..."
              }
              className="w-full bg-input border border-border rounded-lg px-4 py-4 pr-24 text-lg font-medium text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              size="sm"
              isLoading={isPostingTimeline}
              onClick={handlePostTimeline}
              disabled={!canPostTimeline}
              className="absolute right-2 top-2 bottom-2 px-6 rounded-md text-md">
              Post
            </Button>
          </div>
        </div>

        {/* Right Column: AI / Info */}
        <div className="flex flex-col gap-8">
          {/* AI Synopsis */}
          <div>
            <h3 className="text-xl font-bold  text-text mb-4 border-b border-border pb-2">
              AI Synopsis
            </h3>
            <div className="bg-bg-surface border border-border rounded-lg p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-lg font-bold text-text-muted uppercase tracking-wider">
                  AI Auto-generated
                </p>
              </div>

              <h4 className="text-md font-bold text-error uppercase tracking-wider mb-1">
                Root Cause
              </h4>
              <p className="text-sm text-text leading-relaxed mb-4">
                {postmortem?.rootCause || "No postmortem generated yet."}
              </p>

              <h4 className="text-md font-bold text-error uppercase tracking-wider mb-1">
                Action Items
              </h4>
              <ol className="text-md text-text leading-relaxed list-decimal pl-4 mb-5">
                {normalizeActionItems(postmortem?.actionItems).map(
                  (item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ),
                )}
                {!normalizeActionItems(postmortem?.actionItems).length && (
                  <li>Generate postmortem to see action items.</li>
                )}
              </ol>
              {isPrivileged && (
                <Button
                  variant="ghost"
                  size="full"
                  isLoading={isGeneratingPostmortem}
                  onClick={handleGeneratePostmortem}
                  className="border border-error/20 text-error hover:bg-error bg-error/10 hover:text-text text-lg cursor-pointer font-bold flex items-center justify-center gap-2">
                  Regenerate Postmortem
                </Button>
              )}
            </div>
          </div>

          {/* Active Responders */}
          <div>
            <h3 className="text-xl font-bold text-text-muted mb-4 border-b border-border pb-2">
              Active Responders
            </h3>
            <div className="flex flex-col gap-2 mb-4">
              {responderList.map((responder) => (
                <div
                  key={responder._id}
                  className="bg-bg-surface border border-border rounded-lg p-3 flex items-center gap-3 shadow-sm group">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-md shrink-0">
                    {(responder?.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-md font-bold text-text truncate">
                      {responder?.name || "Unknown"}
                    </p>
                    <p className="text-sm font-medium text-text-muted truncate">
                      {responder?.email}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {responder?.role && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/15 text-primary border border-primary/20">
                          {responder.role}
                        </span>
                      )}
                      {responder?.teamTag && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-bg-muted text-text-muted border border-border">
                          {getTeamTagLabel(responder.teamTag)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isPrivileged && String(responder._id) !== String(user?._id ?? user?.id ?? "") && (
                    <button
                      onClick={() => handleRemoveResponder(responder._id)}
                      disabled={removingResponderId === responder._id}
                      title={`Remove ${responder?.name || "responder"}`}
                      className="shrink-0 text-error/60 hover:text-error transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {removingResponderId === responder._id ? (
                        <span className="w-6 h-6 block border-2 border-error/40 border-t-error rounded-full animate-spin" />
                      ) : (
                        <IoCloseCircle size={22} />
                      )}
                    </button>
                  )}
                </div>
              ))}
              {responderList.length === 0 && (
                <div className="text-text-muted text-sm">
                  No responders assigned.
                </div>
              )}
            </div>
            {isPrivileged && (
              <div className="flex gap-2 items-stretch">
                <AssignMemberPicker
                  members={companyMembers}
                  assignedIds={assignedResponderIds}
                  value={selectedResponderId}
                  onChange={setSelectedResponderId}
                  disabled={isAssigningResponder}
                />
                <Button
                  size="sm"
                  isLoading={isAssigningResponder}
                  onClick={handleAssignResponder}
                  disabled={!selectedResponderId}
                  className="px-4 whitespace-nowrap self-end">
                  Assign
                </Button>
              </div>
            )}
          </div>

          {/* Incident Info */}
          <div>
            <h3 className="text-xl font-bold text-text-muted mb-4 border-b border-border pb-2">
              Incident Info
            </h3>
            <div className="flex flex-col gap-2 text-lg">
              <div className="flex justify-between">
                <span className="text-text-muted">Created by</span>
                <span className="text-text font-medium">
                  {incident?.createdBy?.name || "--"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Created at</span>
                <span className="text-text font-medium">
                  {formatDateTime(incident.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Timeline events</span>
                <span className="text-text font-medium">{timeline.length}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-text-muted">Company</span>
                <span className="text-text font-medium">
                  {incident.companyId || "--"}
                </span>
              </div>
              {isPrivileged && (
                <Button
                  size="full"
                  isLoading={isUpdatingStatus}
                  onClick={() => handleStatusUpdate("RESOLVED")}
                  className="font-bold rounded-lg flex items-center justify-center text-lg">
                  ✓ Mark as Resolved
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetails;
