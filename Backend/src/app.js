import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import companyRoutes from "./routes/company.routes.js";
import incidentRoutes from "./routes/incident.routes.js";
import timelineRoutes from "./routes/timeline.routes.js";
import postmortemRoutes from "./routes/postmortem.routes.js";
import statusRoutes from "./routes/status.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();
// Render/other PaaS run behind reverse proxies, so trust X-Forwarded-* headers.
const rawTrustProxy = process.env.TRUST_PROXY;
let trustProxySetting;
if (rawTrustProxy === undefined) {
  trustProxySetting = process.env.NODE_ENV === "production" ? 1 : false;
} else if (rawTrustProxy === "true") {
  trustProxySetting = true;
} else if (rawTrustProxy === "false") {
  trustProxySetting = false;
} else {
  const asNumber = Number(rawTrustProxy);
  trustProxySetting = Number.isNaN(asNumber) ? rawTrustProxy : asNumber;
}
app.set("trust proxy", trustProxySetting);
app.use(cookieParser());

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 100000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/incidents", postmortemRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
