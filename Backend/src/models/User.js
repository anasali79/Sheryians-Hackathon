import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["ADMIN", "CEO", "DEVELOPER", "MEMBER"], default: "MEMBER" },
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
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    this.password = await bcrypt.hash(this.password, 12);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual("fullProfile").get(function fullProfile() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    companyId: this.companyId,
  };
});

const User = mongoose.model("User", userSchema);
export default User;
