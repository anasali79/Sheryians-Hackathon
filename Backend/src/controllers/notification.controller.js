import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/notifications
 * Fetch current user's notifications (newest first, max 30).
 */
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      companyId: req.user.companyId._id || req.user.companyId,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      companyId: req.user.companyId._id || req.user.companyId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the current user.
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        companyId: req.user.companyId._id || req.user.companyId,
        isRead: false,
      },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return next(new ApiError(404, "Notification not found"));
    }

    return res.status(200).json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  getNotifications,
  markAllAsRead,
  markAsRead,
};
