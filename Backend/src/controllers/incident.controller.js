import { validationResult } from "express-validator";
import Incident from "../models/Incident.js";
import Timeline from "../models/Timeline.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { sendAssignmentEmail } from "../services/email.service.js";
import { createNotification, createBulkNotifications } from "../services/notification.service.js";
import { getIO } from "../socket/socket.js";

const handleValidation = (req, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, "Validation failed", errors.array()));
  }
  return null;
};

export const createIncident = async (req, res, next) => {
  try {
    const validationError = handleValidation(req, next);
    if (validationError) {
      return validationError;
    }

    const { title, description, severity } = req.body;

    const incident = await Incident.create({
      title,
      description,
      severity,
      createdBy: req.user._id,
      companyId: req.user.companyId,
      assignedUsers: [req.user._id],
    });

    const populatedIncident = await Incident.findById(incident._id)
      .populate("createdBy", "name email")
      .populate("assignedUsers", "name email role teamTag");

    getIO().to(`company-${req.user.companyId}`).emit("incident:created", populatedIncident);

    // Notify all active company members about the new incident
    const companyMembers = await User.find({
      companyId: req.user.companyId,
      isActive: true,
      _id: { $ne: req.user._id },
    }).select("_id");

    if (companyMembers.length > 0) {
      createBulkNotifications(
        companyMembers.map((m) => String(m._id)),
        {
          companyId: req.user.companyId,
          type: "incident_created",
          title: "New Incident Created",
          message: `${req.user.name} created incident: ${title} [${severity}]`,
          link: `/incidents/${incident._id}`,
          relatedIncident: incident._id,
          relatedUser: req.user._id,
        }
      ).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      data: {
        incident: populatedIncident,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getIncidents = async (req, res, next) => {
  try {
    const { status, severity } = req.query;

    const query = {
      companyId: req.user.companyId,
    };

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    const incidents = await Incident.find(query)
      .populate("createdBy", "name email")
      .populate("assignedUsers", "name email role teamTag")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        incidents,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .populate("createdBy", "name email")
      .populate("assignedUsers", "name email role teamTag");

    if (!incident) {
      return next(new ApiError(404, "Incident not found"));
    }

    const timelineCount = await Timeline.countDocuments({
      incidentId: incident._id,
      companyId: req.user.companyId,
    });

    return res.status(200).json({
      success: true,
      data: {
        incident,
        timelineCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateIncidentStatus = async (req, res, next) => {
  try {
    const validationError = handleValidation(req, next);
    if (validationError) {
      return validationError;
    }

    const { status } = req.body;

    const update = { status };
    if (status === "RESOLVED") {
      update.resolvedAt = new Date();
    }

    const incident = await Incident.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId,
      },
      update,
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("assignedUsers", "name email role teamTag");

    if (!incident) {
      return next(new ApiError(404, "Incident not found"));
    }

    getIO().to(`company-${req.user.companyId}`).emit("incident:updated", incident);

    // If resolved, notify all assigned users
    if (status === "RESOLVED" && incident.assignedUsers?.length > 0) {
      const assignedIds = incident.assignedUsers
        .map((u) => (typeof u === "object" ? String(u._id) : String(u)))
        .filter((uid) => uid !== String(req.user._id));

      if (assignedIds.length > 0) {
        createBulkNotifications(assignedIds, {
          companyId: req.user.companyId,
          type: "incident_resolved",
          title: "Incident Resolved",
          message: `${req.user.name} resolved incident: ${incident.title}`,
          link: `/incidents/${incident._id}`,
          relatedIncident: incident._id,
          relatedUser: req.user._id,
        }).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        incident,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const assignIncidentUsers = async (req, res, next) => {
  try {
    const validationError = handleValidation(req, next);
    if (validationError) {
      return validationError;
    }

    const { userIds } = req.body;

    const incident = await Incident.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!incident) {
      return next(new ApiError(404, "Incident not found"));
    }

    const users = await User.find({
      _id: { $in: userIds },
      companyId: req.user.companyId,
      isActive: true,
    });

    if (users.length !== userIds.length) {
      return next(new ApiError(400, "All assigned users must belong to your company"));
    }

    incident.assignedUsers = userIds;
    await incident.save();

    const incidentLink = `${process.env.FRONTEND_URL}/incidents/${incident._id}`;

    await Promise.all(
      users.map((user) =>
        sendAssignmentEmail({
          to: user.email,
          userName: user.name,
          incidentTitle: incident.title,
          severity: incident.severity,
          incidentLink,
        })
      )
    );

    const populatedIncident = await Incident.findById(incident._id)
      .populate("createdBy", "name email")
      .populate("assignedUsers", "name email role teamTag");

    getIO().to(`company-${req.user.companyId}`).emit("incident:assigned", populatedIncident);

    // Notify newly assigned users
    const previousUserIds = (incident.assignedUsers || []).map((u) => String(u));
    const newlyAssigned = userIds.filter(
      (uid) => !previousUserIds.includes(String(uid)) && String(uid) !== String(req.user._id)
    );

    if (newlyAssigned.length > 0) {
      createBulkNotifications(newlyAssigned, {
        companyId: req.user.companyId,
        type: "incident_assigned",
        title: "Assigned to Incident",
        message: `You have been assigned to incident: ${incident.title} [${incident.severity}]`,
        link: `/incidents/${incident._id}`,
        relatedIncident: incident._id,
        relatedUser: req.user._id,
      }).catch(() => {});
    }

    // Notify removed users
    const removedUsers = previousUserIds.filter(
      (uid) => !userIds.includes(uid) && uid !== String(req.user._id)
    );

    if (removedUsers.length > 0) {
      createBulkNotifications(removedUsers, {
        companyId: req.user.companyId,
        type: "responder_removed",
        title: "Removed from Incident",
        message: `You have been removed from incident: ${incident.title}`,
        link: `/incidents/${incident._id}`,
        relatedIncident: incident._id,
        relatedUser: req.user._id,
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: {
        incident: populatedIncident,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  assignIncidentUsers,
};
