export const TEAM_TAGS = [
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
];

export const TEAM_TAG_LABELS = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  DEVOPS: "DevOps",
  QA: "QA",
  DESIGN: "Design",
  PRODUCT: "Product",
  MOBILE: "Mobile",
  FULLSTACK: "Full Stack",
  SRE: "SRE",
  DATA: "Data",
};

export const isValidTeamTag = (tag) =>
  tag === null || tag === undefined || tag === "" || TEAM_TAGS.includes(tag);
