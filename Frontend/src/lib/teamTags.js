export const TEAM_TAG_OPTIONS = [
  { value: "", label: "No tag" },
  { value: "FRONTEND", label: "Frontend" },
  { value: "BACKEND", label: "Backend" },
  { value: "DEVOPS", label: "DevOps" },
  { value: "QA", label: "QA" },
  { value: "DESIGN", label: "Design" },
  { value: "PRODUCT", label: "Product" },
  { value: "MOBILE", label: "Mobile" },
  { value: "FULLSTACK", label: "Full Stack" },
  { value: "SRE", label: "SRE" },
  { value: "DATA", label: "Data" },
];

export const INVITE_ROLE_OPTIONS = [
  { value: "DEVELOPER", label: "Developer" },
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "ADMIN" },
];

export const MEMBER_ROLE_OPTIONS = [
  { value: "DEVELOPER", label: "Developer" },
  { value: "MEMBER", label: "Member" },
];

export const CEO_MEMBER_ROLE_OPTIONS = [
  ...MEMBER_ROLE_OPTIONS,
  { value: "ADMIN", label: "Admin" },
];

export const getTeamTagLabel = (tag) =>
  TEAM_TAG_OPTIONS.find((option) => option.value === tag)?.label || tag || "—";
