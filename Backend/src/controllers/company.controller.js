import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import Invite from "../models/Invite.js";
import Incident from "../models/Incident.js";
import generateInviteToken from "../utils/generateInvite.js";
import generateToken from "../utils/generateToken.js";
import logger from "../utils/logger.js";
import { sendInviteEmail } from "../services/email.service.js";
import { isValidTeamTag, TEAM_TAG_LABELS } from "../constants/teamTags.js";
import { createNotification, createBulkNotifications } from "../services/notification.service.js";

const validationOrThrow = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }
};

const frontendOrigin = () => String(process.env.FRONTEND_URL || "").replace(/\/$/, "");

const getCompanyId = (req) => req.user.companyId?._id || req.user.companyId;

const assertCanManageTarget = async (req, targetUser, company) => {
  if (!targetUser) {
    throw new ApiError(404, "Member not found");
  }

  if (String(targetUser._id) === String(req.user._id)) {
    throw new ApiError(403, "You cannot perform this action on your own account");
  }

  if (company?.ownerId && String(company.ownerId) === String(targetUser._id)) {
    throw new ApiError(403, "Cannot modify the workspace owner");
  }

  if (["ADMIN", "CEO"].includes(targetUser.role) && req.user.role !== "CEO") {
    throw new ApiError(403, "Only CEO can manage admins and executives");
  }
};

export const inviteMember = async (req, res, next) => {
  try {
    validationOrThrow(req);

    const { email, role, teamTag } = req.body;

    if (teamTag !== undefined && !isValidTeamTag(teamTag)) {
      throw new ApiError(400, "Invalid team tag");
    }

    const inviteRole = role || "DEVELOPER";
    if (inviteRole === "CEO") {
      throw new ApiError(400, "Cannot invite users as CEO");
    }
    if (
      inviteRole === "ADMIN" &&
      req.user.role !== "CEO" &&
      req.user.role !== "ADMIN"
    ) {
      throw new ApiError(403, "Only CEO or Admin can invite admins");
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      companyId: req.user.companyId._id,
    });

    if (existingUser) {
      throw new ApiError(409, "This person is already a member of your company");
    }

    const pendingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      companyId: req.user.companyId._id,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (pendingInvite) {
      throw new ApiError(409, "An invite has already been sent to this email");
    }

    const token = generateInviteToken();

    const invitePayload = {
      email: email.toLowerCase(),
      companyId: req.user.companyId._id,
      invitedBy: req.user._id,
      role: inviteRole,
      token,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    };
    if (teamTag) invitePayload.teamTag = teamTag;

    await Invite.create(invitePayload);

    const base = frontendOrigin() || "http://localhost:3000";
    const inviteLink = `${base}/accept-invite?token=${encodeURIComponent(token)}`;

    sendInviteEmail({
      to: email,
      inviteLink,
      companyName: req.user.companyId.name,
      invitedByName: req.user.name,
    }).catch((err) => logger.error("Invite email send failed", err.message));

    // Create notification for the admin who sent the invite
    createNotification({
      recipientId: req.user._id,
      companyId: req.user.companyId._id,
      type: "invite_sent",
      title: "Invite Sent",
      message: `Invitation sent to ${email} as ${inviteRole}`,
      link: null,
      relatedUser: req.user._id,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Invitation sent to ${email}`,
      data: {},
    });
  } catch (error) {
    return next(error);
  }
};

export const getInviteSetup = async (req, res, next) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      throw new ApiError(400, "token query parameter is required");
    }

    const invite = await Invite.findOne({ token }).populate("companyId", "name slug");

    if (!invite) {
      throw new ApiError(400, "Invalid invite link");
    }

    if (invite.isUsed) {
      throw new ApiError(400, "This invite has already been used — sign in with your email instead");
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, "This invite has expired. Ask your admin to send a new one");
    }

    return res.status(200).json({
      success: true,
      data: {
        email: invite.email,
        companyName: invite.companyId?.name || "Your team",
        role: invite.role || "MEMBER",
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const acceptInvite = async (req, res, next) => {
  try {
    validationOrThrow(req);

    const { token, name, email, password } = req.body;

    const invite = await Invite.findOne({ token }).populate("companyId");

    if (!invite) {
      throw new ApiError(400, "Invalid invite link");
    }

    if (invite.isUsed) {
      throw new ApiError(400, "This invite has already been used");
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, "This invite has expired. Ask your admin to send a new one");
    }

    const displayName = String(name || "").trim();
    const submittedEmail = String(email || "").toLowerCase().trim();

    if (submittedEmail !== invite.email) {
      throw new ApiError(
        400,
        `Sign up with the same email this invite was sent to (${invite.email})`
      );
    }

    const alreadyRegistered = await User.findOne({ email: invite.email.toLowerCase() });
    if (alreadyRegistered) {
      throw new ApiError(409, "An account with this email already exists. Please login instead");
    }

    const userPayload = {
      name: displayName,
      email: invite.email.toLowerCase(),
      password,
      role: invite.role || "DEVELOPER",
      companyId: invite.companyId._id,
      isEmailVerified: true,
    };
    if (invite.teamTag) userPayload.teamTag = invite.teamTag;

    const user = await User.create(userPayload);

    user.lastLogin = new Date();
    await user.save();

    await Company.findByIdAndUpdate(invite.companyId._id, {
      $push: { members: user._id },
    });

    invite.isUsed = true;
    await invite.save();

    // Notify the admin who sent the invite
    createNotification({
      recipientId: invite.invitedBy,
      companyId: invite.companyId._id,
      type: "invite_accepted",
      title: "Invite Accepted",
      message: `${displayName || invite.email} accepted the invite and joined the team`,
      link: null,
      relatedUser: user._id,
    }).catch(() => {});

    // Notify all admins & CEO about new member joining
    const admins = await User.find({
      companyId: invite.companyId._id,
      role: { $in: ["ADMIN", "CEO"] },
      isActive: true,
      _id: { $ne: invite.invitedBy },
    }).select("_id");

    if (admins.length > 0) {
      createBulkNotifications(
        admins.map((a) => String(a._id)),
        {
          companyId: invite.companyId._id,
          type: "invite_accepted",
          title: "New Member Joined",
          message: `${displayName || invite.email} joined the team as ${user.role}`,
          link: null,
          relatedUser: user._id,
        }
      ).catch(() => {});
    }

    const jwtToken = generateToken({
      userId: user._id,
      role: user.role,
      companyId: invite.companyId._id,
    });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(201).json({
      success: true,
      message: `Welcome to ${invite.companyId.name}! Your account has been created.`,
      data: {
        token: jwtToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: {
            id: invite.companyId._id,
            name: invite.companyId.name,
            slug: invite.companyId.slug,
          },
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyMembers = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const [users, company] = await Promise.all([
      User.find({ companyId, isActive: { $ne: false } }).select("-password"),
      Company.findById(companyId).select("ownerId"),
    ]);

    const members = users.map((user) => ({
      ...user.toObject(),
      isOwner: company?.ownerId && String(company.ownerId) === String(user._id),
    }));

    return res.status(200).json({
      success: true,
      message: "Members fetched successfully",
      data: {
        count: members.length,
        members,
        ownerId: company?.ownerId || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.companyId._id)
      .populate("members", "name email role isActive lastLogin")
      .populate("ownerId", "name email");

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    return res.status(200).json({
      success: true,
      message: "Company fetched successfully",
      data: { company },
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyOverview = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const company = await Company.findById(companyId)
      .populate("ownerId", "name email role createdAt")
      .lean();

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    const [members, incidents, pendingInvitesCount] = await Promise.all([
      User.find({ companyId, isActive: { $ne: false } }).select(
        "role teamTag lastLogin createdAt"
      ),
      Incident.find({ companyId }).select("status severity createdAt updatedAt"),
      Invite.countDocuments({
        companyId,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      }),
    ]);

    const membersByRole = { CEO: 0, ADMIN: 0, DEVELOPER: 0, MEMBER: 0 };
    let activeLast24h = 0;
    const dayAgo = Date.now() - 86400000;

    members.forEach((member) => {
      if (Object.prototype.hasOwnProperty.call(membersByRole, member.role)) {
        membersByRole[member.role] += 1;
      }
      if (member.lastLogin && new Date(member.lastLogin).getTime() > dayAgo) {
        activeLast24h += 1;
      }
    });

    const incidentsByStatus = { OPEN: 0, INVESTIGATING: 0, RESOLVED: 0 };
    let activeP1 = 0;

    incidents.forEach((incident) => {
      if (incidentsByStatus[incident.status] !== undefined) {
        incidentsByStatus[incident.status] += 1;
      }
      if (incident.severity === "P1" && incident.status !== "RESOLVED") {
        activeP1 += 1;
      }
    });

    const base = frontendOrigin();
    const publicStatusPath = company.slug ? `/api/status/public/${company.slug}` : null;

    return res.status(200).json({
      success: true,
      message: "Company overview fetched successfully",
      data: {
        company: {
          id: company._id,
          name: company.name,
          slug: company.slug,
          plan: company.plan,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
        owner: company.ownerId
          ? {
              id: company.ownerId._id,
              name: company.ownerId.name,
              email: company.ownerId.email,
              role: company.ownerId.role,
              memberSince: company.ownerId.createdAt,
            }
          : null,
        stats: {
          members: {
            total: members.length,
            byRole: membersByRole,
            activeLast24h,
          },
          incidents: {
            total: incidents.length,
            byStatus: incidentsByStatus,
            activeP1,
          },
          pendingInvites: pendingInvitesCount,
        },
        links: {
          workspaceStatusPage: base ? `${base}/admin/status` : null,
          publicStatusApi: base && publicStatusPath ? `${base}${publicStatusPath}` : null,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMember = async (req, res, next) => {
  try {
    validationOrThrow(req);

    const { id } = req.params;
    const { role, teamTag } = req.body;
    const companyId = getCompanyId(req);

    const company = await Company.findById(companyId);
    const target = await User.findOne({ _id: id, companyId });

    await assertCanManageTarget(req, target, company);

    if (role !== undefined) {
      const allowedRoles = ["DEVELOPER", "MEMBER"];
      if (req.user.role === "CEO") allowedRoles.push("ADMIN");

      if (!allowedRoles.includes(role)) {
        throw new ApiError(400, `Role must be one of: ${allowedRoles.join(", ")}`);
      }

      if (role === "ADMIN" && req.user.role !== "CEO") {
        throw new ApiError(403, "Only CEO can assign admin role");
      }

      target.role = role;
    }

    if (teamTag !== undefined) {
      if (!isValidTeamTag(teamTag)) {
        throw new ApiError(400, "Invalid team tag");
      }
      target.teamTag = teamTag || undefined;
    }

    await target.save();

    return res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: {
        member: {
          _id: target._id,
          name: target.name,
          email: target.email,
          role: target.role,
          teamTag: target.teamTag || null,
          isActive: target.isActive,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const company = await Company.findById(companyId);
    const target = await User.findOne({ _id: id, companyId });

    await assertCanManageTarget(req, target, company);

    target.isActive = false;
    target.teamTag = undefined;
    await target.save();

    await Company.findByIdAndUpdate(companyId, {
      $pull: { members: target._id },
    });

    return res.status(200).json({
      success: true,
      message: `${target.name} has been removed from the workspace`,
      data: {},
    });
  } catch (error) {
    return next(error);
  }
};

export const revokeInvite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const invite = await Invite.findOne({
      _id: id,
      companyId,
      isUsed: false,
    });

    if (!invite) {
      throw new ApiError(404, "Pending invite not found");
    }

    await Invite.deleteOne({ _id: invite._id });

    return res.status(200).json({
      success: true,
      message: "Invitation revoked",
      data: {},
    });
  } catch (error) {
    return next(error);
  }
};

export const getTeamTagOptions = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        tags: Object.entries(TEAM_TAG_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getPendingInvites = async (req, res, next) => {
  try {
    const invites = await Invite.find({
      companyId: req.user.companyId._id,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    })
      .populate("invitedBy", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Pending invites fetched successfully",
      data: { invites },
    });
  } catch (error) {
    return next(error);
  }
};
