import { Navigate, Outlet, useLocation } from "react-router";
import { useSelector } from "react-redux";
import { canManageWorkspace } from "../lib/workspacePaths";
import Loader from "../shared/components/Loader";

const RequireWorkspaceAccess = () => {
  const user = useSelector((state) => state.auth.user);
  const authLoading = useSelector((state) => state.auth.authLoading);
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader label="Signing you in…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (location.pathname.startsWith("/admin") && !canManageWorkspace(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RequireWorkspaceAccess;
