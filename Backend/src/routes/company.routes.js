import express from "express";
import { body, param } from "express-validator";
import {
  inviteMember,
  acceptInvite,
  getInviteSetup,
  getCompanyMembers,
  getMyCompany,
  getCompanyOverview,
  getPendingInvites,
  updateMember,
  removeMember,
  revokeInvite,
  getTeamTagOptions,
} from "../controllers/company.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { TEAM_TAGS } from "../constants/teamTags.js";

const router = express.Router();

const teamTagValidator = body("teamTag")
  .optional({ values: "null" })
  .isIn([...TEAM_TAGS, "", null])
  .withMessage("Invalid team tag");

router.get("/invite/setup", getInviteSetup);

router.post(
  "/invite/accept",
  [
    body("token").trim().notEmpty().withMessage("token is required"),
    body("name").trim().notEmpty().withMessage("name is required"),
    body("email").isEmail().withMessage("valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
  ],
  acceptInvite
);

router.post(
  "/invite",
  protect,
  authorize("ADMIN", "CEO"),
  [
    body("email").isEmail().withMessage("valid email is required"),
    body("role")
      .optional()
      .isIn(["ADMIN", "DEVELOPER", "MEMBER"])
      .withMessage("role must be ADMIN, DEVELOPER, or MEMBER"),
    teamTagValidator,
  ],
  inviteMember
);

router.get("/members", protect, getCompanyMembers);
router.get("/me", protect, getMyCompany);
router.get(
  "/overview",
  protect,
  authorize("ADMIN", "CEO"),
  getCompanyOverview
);
router.get("/team-tags", protect, getTeamTagOptions);
router.get("/invites/pending", protect, authorize("ADMIN", "CEO"), getPendingInvites);

router.patch(
  "/members/:id",
  protect,
  authorize("ADMIN", "CEO"),
  [
    param("id").isMongoId().withMessage("valid member id is required"),
    body("role")
      .optional()
      .isIn(["ADMIN", "DEVELOPER", "MEMBER"])
      .withMessage("role must be ADMIN, DEVELOPER, or MEMBER"),
    teamTagValidator,
  ],
  updateMember
);

router.delete(
  "/members/:id",
  protect,
  authorize("ADMIN", "CEO"),
  [param("id").isMongoId().withMessage("valid member id is required")],
  removeMember
);

router.delete(
  "/invites/:id",
  protect,
  authorize("ADMIN", "CEO"),
  [param("id").isMongoId().withMessage("valid invite id is required")],
  revokeInvite
);

export default router;
