import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["CEO", "ADMIN", "DEVELOPER", "MEMBER"], default: "DEVELOPER" },
    teamTag: {
      type: String,
      enum: [
        "FRONTEND",
        "BACKEND",
        "DEVOPS",
        "QA",
        "DESIGN",
        "PRODUCT",
        "MOBILE",
        "FULLSTACK",
        "SRE",
        "DATA",
      ],
    },
    token: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

inviteSchema.index({ email: 1, companyId: 1 });

const Invite = mongoose.model("Invite", inviteSchema);
export default Invite;
