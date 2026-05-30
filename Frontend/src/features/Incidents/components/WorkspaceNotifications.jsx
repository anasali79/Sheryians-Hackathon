import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { FiBell, FiCheck, FiCheckCircle } from "react-icons/fi";
import { io } from "socket.io-client";
import { api } from "../../../api/httpClient";
import { getSocketBaseUrl } from "../../../lib/socketBaseUrl";
import {
  typeStyles,
  formatRelative,
  getTypeLabel,
  getTypeIcon,
} from "../../../lib/workspaceNotifications";
import { useWorkspacePaths } from "../hooks/useWorkspacePaths";

const POLL_MS = 60_000;

const WorkspaceNotifications = () => {
  const navigate = useNavigate();
  const paths = useWorkspacePaths();
  const user = useSelector((state) => state.auth.user);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);

  // --- Fetch notifications from API ---
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/notifications");
      setNotifications(res?.data?.notifications || []);
      setUnreadCount(res?.data?.unreadCount || 0);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Initial fetch + polling ---
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // --- Real-time socket listener ---
  useEffect(() => {
    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("notification:new", (notification) => {
      setNotifications((prev) => {
        // Avoid duplicates
        if (prev.some((n) => n._id === notification._id)) return prev;
        return [notification, ...prev].slice(0, 30);
      });
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off("notification:new");
      socket.disconnect();
    };
  }, []);

  // --- Close on outside click ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Mark all as read ---
  const markAllRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  // --- Mark single as read ---
  const markSingleRead = useCallback(async (notifId) => {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, []);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = async (notification) => {
    setIsOpen(false);

    // Mark as read
    if (!notification.isRead) {
      markSingleRead(notification._id);
    }

    // Navigate to linked page
    if (notification.link) {
      // Add proper prefix based on current workspace
      const fullPath = paths.isAdminShell
        ? `/admin${notification.link}`
        : notification.link;
      navigate(fullPath);
    }
  };

  // Derive display-friendly list
  const displayNotifications = useMemo(() => {
    return notifications.map((n) => ({
      ...n,
      typeLabel: getTypeLabel(n.type),
      typeIcon: getTypeIcon(n.type),
      timeLabel: formatRelative(n.createdAt),
      styleClass: typeStyles[n.type] || "bg-bg-muted text-text-muted border-border",
    }));
  }, [notifications]);

  return (
    <div ref={containerRef} className="relative ml-3">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label="Notifications"
        className="text-text-muted hover:text-text transition-colors relative p-1 cursor-pointer">
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-error text-error-foreground text-[9px] font-bold rounded-full border-2 border-bg flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-bg border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-text">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-error uppercase">
                  {unreadCount} new
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <FiCheckCircle size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && notifications.length === 0 && (
              <p className="px-4 py-6 text-xs text-text-muted text-center">
                Loading…
              </p>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <FiBell size={28} className="mx-auto text-text-muted/40 mb-2" />
                <p className="text-xs text-text-muted">
                  No notifications yet
                </p>
              </div>
            )}

            <ul>
              {displayNotifications.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40 last:border-b-0 ${
                      !item.isRead ? "bg-primary/[0.03]" : ""
                    }`}>
                    <div className="flex items-start gap-3">
                      {/* Type badge */}
                      <span
                        className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${item.styleClass}`}>
                        {item.typeIcon}
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-text">
                            {item.title}
                          </p>
                          {!item.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${item.styleClass}`}>
                            {item.typeLabel}
                          </span>
                          <span className="text-[10px] text-text-muted/70">
                            {item.timeLabel}
                          </span>
                        </div>
                      </div>

                      {/* Read indicator */}
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markSingleRead(item._id);
                          }}
                          title="Mark as read"
                          className="shrink-0 text-text-muted hover:text-primary transition-colors p-1 cursor-pointer">
                          <FiCheck size={14} />
                        </button>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-bg-surface/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(paths.dashboard);
                }}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                View dashboard
              </button>
              <span className="text-[10px] text-text-muted">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceNotifications;
