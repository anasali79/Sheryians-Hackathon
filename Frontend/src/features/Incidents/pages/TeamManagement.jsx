import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { canManageWorkspace } from "../../../lib/workspacePaths";
import {
  CEO_MEMBER_ROLE_OPTIONS,
  getTeamTagLabel,
  INVITE_ROLE_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  TEAM_TAG_OPTIONS,
} from "../../../lib/teamTags";
import Button from "../../../shared/components/Button";
import Input from "../../../shared/components/Input";
import Loader from "../../../shared/components/Loader";
import { PiHourglassHighFill } from "react-icons/pi";
import { FiEdit2, FiTrash2, FiUserX, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { api } from "../../../api/httpClient";

const getAvatarColor = (role) => {
  if (role === "CEO") return "bg-error/10 text-error";
  if (role === "ADMIN") return "bg-success/10 text-success";
  if (role === "DEVELOPER") return "bg-primary/10 text-primary";
  return "bg-ring/10 text-ring";
};

const selectClassName =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm font-semibold text-text focus:border-primary focus:outline-none";

const TeamManagement = () => {
  const user = useSelector((state) => state.auth.user);
  const isPrivileged = canManageWorkspace(user?.role);
  const isCeo = user?.role === "CEO";

  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DEVELOPER");
  const [inviteTeamTag, setInviteTeamTag] = useState("FRONTEND");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [busyInviteId, setBusyInviteId] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editDraft, setEditDraft] = useState({ role: "", teamTag: "" });

  const inviteRoleOptions = INVITE_ROLE_OPTIONS;
  const memberRoleOptions = isCeo ? CEO_MEMBER_ROLE_OPTIONS : MEMBER_ROLE_OPTIONS;

  const fetchTeamData = async () => {
    try {
      setIsLoadingData(true);
      setErrorMessage("");

      const membersPromise = api.get("/company/members");
      const invitesPromise = isPrivileged
        ? api.get("/company/invites/pending")
        : Promise.resolve({ data: { invites: [] } });

      const [membersRes, invitesRes] = await Promise.all([
        membersPromise,
        invitesPromise,
      ]);

      setMembers(membersRes?.data?.members || []);
      setPendingInvites(invitesRes?.data?.invites || []);
    } catch (error) {
      setErrorMessage(error?.message || "Failed to fetch team data.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const currentUserId = user?._id || user?.id;

  const canManageMember = useMemo(
    () => (member) => {
      if (!isPrivileged) return false;
      if (String(member._id) === String(currentUserId)) return false;
      if (member.isOwner) return false;
      if (["ADMIN", "CEO"].includes(member.role) && !isCeo) return false;
      return true;
    },
    [isPrivileged, isCeo, currentUserId],
  );

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Please enter email address");
      return;
    }

    try {
      setIsSendingInvite(true);
      await api.post("/company/invite", {
        email,
        role: inviteRole,
        teamTag: inviteTeamTag || undefined,
      });
      toast.success("Invite sent successfully");
      setInviteEmail("");
      setInviteRole("DEVELOPER");
      setInviteTeamTag("FRONTEND");
      await fetchTeamData();
    } catch (error) {
      toast.error(error?.message || "Failed to send invite");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const updateMember = async (memberId, payload) => {
    try {
      setBusyMemberId(memberId);
      await api.patch(`/company/members/${memberId}`, payload);
      toast.success("Member updated");
      setEditingMemberId(null);
      await fetchTeamData();
    } catch (error) {
      toast.error(error?.message || "Failed to update member");
    } finally {
      setBusyMemberId(null);
    }
  };

  const startEditMember = (member) => {
    setEditingMemberId(member._id);
    setEditDraft({
      role: member.role,
      teamTag: member.teamTag || "",
    });
  };

  const cancelEditMember = () => {
    setEditingMemberId(null);
    setEditDraft({ role: "", teamTag: "" });
  };

  const saveEditMember = async (memberId) => {
    await updateMember(memberId, {
      role: editDraft.role,
      teamTag: editDraft.teamTag || null,
    });
  };

  const removeMember = async (member) => {
    const confirmed = window.confirm(
      `Remove ${member.name} from the workspace? They will lose access immediately.`,
    );
    if (!confirmed) return;

    try {
      setBusyMemberId(member._id);
      await api.delete(`/company/members/${member._id}`);
      toast.success(`${member.name} removed`);
      await fetchTeamData();
    } catch (error) {
      toast.error(error?.message || "Failed to remove member");
    } finally {
      setBusyMemberId(null);
    }
  };

  const revokeInvite = async (invite) => {
    try {
      setBusyInviteId(invite._id);
      await api.delete(`/company/invites/${invite._id}`);
      toast.success("Invite revoked");
      await fetchTeamData();
    } catch (error) {
      toast.error(error?.message || "Failed to revoke invite");
    } finally {
      setBusyInviteId(null);
    }
  };

  if (isLoadingData) return <Loader />;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg overflow-y-auto">
      <div className="h-[80px] border-b border-border flex items-center justify-between px-8 shrink-0 bg-bg">
        <h1 className="text-2xl font-bold text-text">Team Management</h1>
      </div>

      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-text mb-2">Team Management</h1>
          <p className="text-xl text-text-muted">
            {isPrivileged
              ? "Invite teammates, assign roles & tags, and manage access"
              : "View your workspace team"}
          </p>
          {errorMessage && (
            <p className="text-error mt-3 text-sm font-medium">{errorMessage}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h3 className="text-lg font-bold text-text-muted uppercase mb-4">
              MEMBERS ({members.length})
            </h3>
            <div className="flex flex-col gap-3">
              {members.map((member) => {
                const manageable = canManageMember(member);
                const isBusy = busyMemberId === member._id;
                const isEditing = editingMemberId === member._id;

                return (
                  <div
                    key={member._id}
                    className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${getAvatarColor(member.role)}`}>
                          {(member.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <h4 className="text-lg font-bold text-text truncate">
                              {member.name}
                            </h4>
                            {member.isOwner && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-ring/10 text-ring border border-ring/20">
                                Owner
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-text-muted truncate">
                            {member.email}
                          </p>
                          {!isEditing && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-xs font-bold text-primary-foreground ${
                                  member.role === "ADMIN" ||
                                  member.role === "CEO"
                                    ? "bg-success"
                                    : "bg-primary"
                                }`}>
                                {member.role}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-bg-muted text-text border border-border">
                                {member.teamTag
                                  ? getTeamTagLabel(member.teamTag)
                                  : "No tag"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {manageable && !isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditMember(member)}
                            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Edit role & tag"
                            aria-label={`Edit ${member.name}`}>
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => removeMember(member)}
                            className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                            title="Remove member"
                            aria-label={`Remove ${member.name}`}>
                            <FiUserX size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    {manageable && isEditing && (
                      <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1.5 block">
                              Role
                            </label>
                            <select
                              className={selectClassName}
                              value={editDraft.role}
                              disabled={isBusy}
                              onChange={(e) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  role: e.target.value,
                                }))
                              }>
                              {memberRoleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1.5 block">
                              Team tag
                            </label>
                            <select
                              className={selectClassName}
                              value={editDraft.teamTag}
                              disabled={isBusy}
                              onChange={(e) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  teamTag: e.target.value,
                                }))
                              }>
                              {TEAM_TAG_OPTIONS.map((opt) => (
                                <option key={opt.value || "none"} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isBusy}
                            onClick={cancelEditMember}
                            className="font-bold gap-1.5">
                            <FiX size={16} />
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isBusy}
                            isLoading={isBusy}
                            onClick={() => saveEditMember(member._id)}
                            className="font-bold">
                            Save changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-5 text-text-muted">
                  No members found.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {isPrivileged && (
              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-text mb-1">Invite teammate</h3>
                <p className="text-md font-medium text-text-muted mb-6">
                  Choose role (Developer, Member, or Admin) and a team tag
                </p>

                <div className="mb-4">
                  <Input
                    id="email"
                    type="email"
                    label="EMAIL ADDRESS"
                    placeholder="dev@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    labelClassName="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
                    Role
                  </label>
                  <select
                    className={selectClassName}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}>
                    {inviteRoleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
                    Team tag
                  </label>
                  <select
                    className={selectClassName}
                    value={inviteTeamTag}
                    onChange={(e) => setInviteTeamTag(e.target.value)}>
                    {TEAM_TAG_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={sendInvite}
                  size="full"
                  isLoading={isSendingInvite}
                  disabled={isSendingInvite}
                  className="font-bold flex items-center justify-center gap-2 text-md">
                  Send invitation
                </Button>
                <p className="text-xs text-text-muted mt-3">
                  CEO/Admin can invite, tag, change roles, and remove members.
                </p>
              </div>
            )}

            {isPrivileged && (
              <div>
                <h3 className="text-md font-bold text-text-muted uppercase mb-4">
                  PENDING INVITES
                </h3>
                <div className="flex flex-col gap-3">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite._id}
                      className="bg-bg-surface border border-border rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-md font-semibold text-text block truncate">
                            {invite.email}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="flex items-center gap-1.5 text-ring text-xs font-bold">
                              <PiHourglassHighFill /> Pending
                            </span>
                            <span className="text-xs font-bold text-text-muted">
                              {invite.role || "DEVELOPER"}
                            </span>
                            {invite.teamTag && (
                              <span className="text-xs font-bold text-primary">
                                {getTeamTagLabel(invite.teamTag)}
                              </span>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busyInviteId === invite._id}
                          onClick={() => revokeInvite(invite)}
                          className="shrink-0 p-2 rounded-lg text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                          title="Revoke invite">
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingInvites.length === 0 && (
                    <div className="bg-bg-surface border border-border rounded-xl p-4 text-text-muted shadow-sm">
                      No pending invites.
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isPrivileged && (
              <div className="bg-bg-surface border border-border rounded-xl p-6 text-text-muted text-sm">
                Only CEO and Admin can invite or manage team members.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagement;
