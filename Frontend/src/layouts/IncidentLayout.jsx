import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useTheme } from "../features/Theme/hooks/useTheme";
import {
  FiGrid,
  FiAlertCircle,
  FiActivity,
  FiUsers,
  FiBriefcase,
} from "react-icons/fi";
import { SiOpslevel } from "react-icons/si";
import { Toaster } from "react-hot-toast";
import { useWorkspacePaths } from "../features/Incidents/hooks/useWorkspacePaths";
import { canManageWorkspace } from "../lib/workspacePaths";
import { useAuth } from "../features/Authentication/hook/useAuth";
import PageBackButton from "../shared/components/PageBackButton";
import WorkspaceSearch from "../features/Incidents/components/WorkspaceSearch";
import WorkspaceNotifications from "../features/Incidents/components/WorkspaceNotifications";

const IncidentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const user = useSelector((state) => state.auth.user);
  const { logoutHandler } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isTopProfileOpen, setIsTopProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const topProfileRef = useRef(null);
  const paths = useWorkspacePaths();
  const isPrivileged = canManageWorkspace(user?.role);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
      if (
        topProfileRef.current &&
        !topProfileRef.current.contains(event.target)
      ) {
        setIsTopProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    setIsTopProfileOpen(false);
    await logoutHandler();
    navigate("/login", { replace: true });
  };

  const hideTopNav =
    location.pathname === "/admin/status" ||
    location.pathname === "/admin/team" ||
    location.pathname === "/status" ||
    location.pathname === "/team";

  const mainNav = [
    { name: "Dashboard", path: paths.dashboard, icon: FiGrid },
    { name: "Incidents", path: paths.incidents, icon: FiAlertCircle },
    { name: "Status Page", path: paths.status, icon: FiActivity },
  ];

  const adminNav = [
    { name: "Company", path: paths.company, icon: FiBriefcase },
    { name: "Team", path: paths.team, icon: FiUsers },
  ];

  const companyLabel =
    user?.companyId?.name || user?.company?.name || "Workspace";

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#606060" : "#ffffff",
            color: theme === "dark" ? "#f5f5f5" : "#1f1f1f",
            border: "1px solid rgba(0,0,0,0.1)",
            fontSize: "1.2rem",
            fontWeight: "bold",
          },
        }}
      />
      <div className="flex min-h-screen flex-col lg:flex-row bg-bg text-text overflow-hidden">
        <aside className="w-full lg:w-65 bg-bg border-b border-border lg:border-b-0 lg:border-r flex flex-col shrink-0">
          <div className="h-20 flex items-center px-6 border-b border-border shrink-0">
            <div className="flex items-center justify-center mr-3">
              <SiOpslevel size={30} />
            </div>
            <div>
              <h1 className="text-text font-bold text-lg leading-tight tracking-wide">
                MayDayOps
              </h1>
              <p className="text-text-muted text-sm font-bold mt-0.5">
                Incident Management
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-6 px-3 text-lg">
            <div>
              <h3 className="text-md font-bold text-text-muted uppercase px-3 mb-2">
                Main
              </h3>
              <nav className="flex flex-col gap-1">
                {mainNav.map((link) => {
                  const isActive =
                    location.pathname === link.path ||
                    (link.path.endsWith("/incidents") &&
                      location.pathname.startsWith(link.path + "/"));
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors relative ${
                        isActive
                          ? "bg-primary/10 text-text border-l-[3px] border-primary"
                          : "text-text-muted hover:text-text hover:bg-primary/10"
                      }`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span className="font-medium">{link.name}</span>
                      </div>
                      {link.badge && (
                        <span className="bg-error text-white absolute left-1/2 top-1 text-error-foreground text-sm h-5 w-5 flex items-center justify-center font-bold px-1.5 py-0.5 rounded-full">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {isPrivileged && (
              <div>
                <h3 className="text-md font-bold text-text-muted uppercase px-3 mb-2">
                  Admin
                </h3>
                <nav className="flex flex-col gap-1">
                  {adminNav.map((link) => {
                    const isActive = location.pathname === link.path;
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.name}
                        to={link.path}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors relative ${
                          isActive
                            ? "bg-primary/10 text-primary border-l-[3px] border-primary"
                            : "text-text-muted hover:text-text hover:bg-primary/10"
                        }`}>
                        <div className="flex items-center gap-3">
                          <Icon size={18} />
                          <span className="font-medium">{link.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {!isPrivileged && (
              <div>
                <h3 className="text-md font-bold text-text-muted uppercase px-3 mb-2">
                  Team
                </h3>
                <nav className="flex flex-col gap-1">
                  <Link
                    to={paths.team}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      location.pathname === paths.team
                        ? "bg-primary/10 text-primary border-l-[3px] border-primary"
                        : "text-text-muted hover:text-text hover:bg-primary/10"
                    }`}>
                    <FiUsers size={18} />
                    <span className="font-medium">Team</span>
                  </Link>
                </nav>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border shrink-0">
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="w-full flex items-center gap-3 bg-bg-surface border border-border p-3 rounded-xl cursor-pointer hover:bg-bg-muted transition-colors">
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {(user?.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden text-left">
                  <div className="text-sm font-bold text-text truncate">
                    {user?.name || "User"}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase font-bold truncate">
                    {user?.role || "—"} · {companyLabel}
                  </div>
                </div>
              </button>
              {isProfileMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-bg border border-border rounded-xl shadow-lg overflow-hidden z-20">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-error hover:bg-error/10 transition-colors font-semibold">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-bg">
          {hideTopNav && (
            <header className="h-14 border-b border-border flex items-center px-8 shrink-0 bg-bg">
              <PageBackButton fallbackPath={paths.dashboard} />
            </header>
          )}
          {!hideTopNav && (
            <header className="h-20 border-b border-border flex items-center justify-between px-8 shrink-0">
              <PageBackButton fallbackPath={paths.dashboard} />

              <div className="flex items-center gap-4">
                <WorkspaceSearch />
                <WorkspaceNotifications />
                <div ref={topProfileRef} className="relative ml-3">
                  <button
                    type="button"
                    onClick={() => setIsTopProfileOpen((prev) => !prev)}
                    className="w-8 h-8 rounded-full bg-bg-muted border border-border overflow-hidden flex items-center justify-center text-xs font-bold text-text hover:bg-bg-surface transition-colors">
                    {(user?.name || "?").charAt(0).toUpperCase()}
                  </button>
                  {isTopProfileOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-bg border border-border rounded-xl shadow-lg p-3 z-20">
                      <div className="text-sm font-bold text-text truncate">
                        {user?.name || "User"}
                      </div>
                      <div className="text-xs text-text-muted uppercase font-bold mt-1 truncate">
                        {companyLabel}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          <main className="flex flex-1 min-h-0 flex-col overflow-y-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default IncidentLayout;
