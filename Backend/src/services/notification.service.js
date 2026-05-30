import Notification from "../models/Notification.js";
import { getIO } from "../socket/socket.js";
import logger from "../utils/logger.js";

/**
 * Create a notification, save to DB, and emit via socket to the recipient's personal room.
 *
 * @param {Object} opts
 * @param {string} opts.recipientId - User ID of the notification recipient
 * @param {string} opts.companyId  - Company ID
 * @param {string} opts.type       - Notification type enum value
 * @param {string} opts.title      - Short title
 * @param {string} opts.message    - Description message
 * @param {string} [opts.link]     - Frontend navigation path
 * @param {string} [opts.relatedIncident] - Related incident ID
 * @param {string} [opts.relatedUser]     - Related user ID
 * @returns {Promise<Object>} The created notification document
 */
export async function createNotification({
  recipientId,
  companyId,
  type,
  title,
  message,
  link = null,
  relatedIncident = null,
  relatedUser = null,
}) {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      companyId,
      type,
      title,
      message,
      link,
      relatedIncident,
      relatedUser,
    });

    // Emit via socket to the user's personal room
    try {
      const io = getIO();
      io.to(`user-${recipientId}`).emit("notification:new", {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        relatedIncident: notification.relatedIncident,
        relatedUser: notification.relatedUser,
      });
    } catch {
      // Socket may not be initialized in tests
    }

    return notification;
  } catch (err) {
    logger.error("Failed to create notification:", err.message);
    return null;
  }
}

/**
 * Create notifications for multiple recipients at once.
 */
export async function createBulkNotifications(recipientIds, baseOpts) {
  const results = await Promise.allSettled(
    recipientIds.map((rid) =>
      createNotification({ ...baseOpts, recipientId: rid })
    )
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
}
