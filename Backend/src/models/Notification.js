import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "invite_sent",
        "invite_accepted",
        "incident_created",
        "incident_assigned",
        "incident_resolved",
        "responder_removed",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    /** Optional link path for frontend navigation */
    link: { type: String, default: null },
    /** Reference to related entities */
    relatedIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
    },
    relatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
