import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import logger from "../utils/logger.js";

let ioInstance;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH"],
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const headerCookie = socket.handshake.headers?.cookie;
      const parsed = headerCookie ? cookie.parse(headerCookie) : {};
      const cookieToken = parsed?.token || parsed?.accessToken;

      const token = cookieToken || socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Socket authentication token missing"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Socket authentication failed"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const companyRoom = `company-${socket.user.companyId}`;
    const userRoom = `user-${socket.user.userId}`;
    socket.join(companyRoom);
    socket.join(userRoom);

    socket.on("join:incident", (incidentId) => {
      socket.join(`incident-${incidentId}`);
    });

    socket.on("leave:incident", (incidentId) => {
      socket.leave(`incident-${incidentId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io has not been initialized");
  }

  return ioInstance;
};

export default {
  initSocket,
  getIO,
};
