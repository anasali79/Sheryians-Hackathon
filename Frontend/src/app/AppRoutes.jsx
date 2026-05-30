import { BrowserRouter, Route, Routes, Navigate } from "react-router";
import EmailVerificationPage from "../features/Authentication/pages/EmailVerificationPage";
import RootLayout from "../layouts/RootLayout";
import Authlayout from "../layouts/Authlayout";
import IncidentLayout from "../layouts/IncidentLayout";
import RequireWorkspaceAccess from "../layouts/RequireWorkspaceAccess";
import LoginPage from "../features/Authentication/pages/LoginPage";
import SignupPage from "../features/Authentication/pages/SignupPage";
import ForgetPassword from "../features/Authentication/pages/ForgetPassword";
import ResetPassword from "../features/Authentication/pages/ResetPassword";
import UserProfile from "../features/Authentication/pages/UserProfile";
import HomePage from "../pages/HomePage";
import About from "../pages/About";
import IncidentAdmin from "../features/Incidents/pages/IncidentAdmin";
import IncidentDashboard from "../features/Incidents/pages/IncidentDashboard";
import IncidentDetails from "../features/Incidents/pages/IncidentDetails";
import IncidentStatusPage from "../features/Incidents/pages/IncidentStatusPage";
import TeamManagement from "../features/Incidents/pages/TeamManagement";
import CompanyPage from "../features/Incidents/pages/CompanyPage";

import DocsLayout from "../layouts/DocsLayout";

import Docs from "../pages/Docs/getting started/Docs";
import QuickStart from "../pages/Docs/getting started/QuickStart";
import FirstIncident from "../pages/Docs/getting started/FirstIncident";

import Incidents from "../pages/Docs/platform/Incidents";
import Workspaces from "../pages/Docs/platform/WorkSpace";
import MembersRoles from "../pages/Docs/platform/MembersRoles";
import TimelineUpdates from "../pages/Docs/platform/TimelineUpdates";
import StatusPage from "../pages/Docs/platform/StatusPage";
import AIPostmortem from "../pages/Docs/platform/AiPostmortem";

import EmailNotifications from "../pages/Docs/integrations/EmailNotification";
import SlackIntegration from "../pages/Docs/integrations/SlackIntegration";

import APIReference from "../pages/Docs/developer/APIReference";
import SDK from "../pages/Docs/developer/SDK";
import Authentication from "../pages/Docs/developer/Authentication";
import ErrorCodes from "../pages/Docs/developer/ErrorCodes";
import RateLimits from "../pages/Docs/developer/RateLimits";
import VerifyEmailPage from "../features/Authentication/pages/VerifyEmailPage";
import AcceptInvitePage from "../features/Authentication/pages/AcceptInvitePage";
import Contact from "../pages/Contact";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROOT */}
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<About />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Docs />} />
          <Route path="quick-start" element={<QuickStart />} />
          <Route path="first-incident" element={<FirstIncident />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="members" element={<MembersRoles />} />
          <Route path="timeline" element={<TimelineUpdates />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="postmortem" element={<AIPostmortem />} />
          <Route path="email" element={<EmailNotifications />} />
          <Route path="slack" element={<SlackIntegration />} />
          <Route path="api" element={<APIReference />} />
          <Route path="auth" element={<Authentication />} />
          <Route path="errors" element={<ErrorCodes />} />
          <Route path="rate-limits" element={<RateLimits />} />
          <Route path="sdk" element={<SDK />} />
        </Route>
        {/* Auth Routes with AUTHLAYOUT */}
        <Route element={<Authlayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="accept-invite" element={<AcceptInvitePage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forget-password" element={<ForgetPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="verify-account" element={<EmailVerificationPage />} />
        </Route>

        {/* Workspace: ADMIN/CEO under /admin/*; DEVELOPER/MEMBER under /dashboard, /incidents, … */}
        <Route element={<RequireWorkspaceAccess />}>
          <Route path="/admin" element={<IncidentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<IncidentDashboard />} />
            <Route path="incidents" element={<IncidentAdmin />} />
            <Route path="incidents/:id" element={<IncidentDetails />} />
            <Route path="status" element={<IncidentStatusPage />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="company" element={<CompanyPage />} />
          </Route>

          <Route path="/dashboard" element={<IncidentLayout />}>
            <Route index element={<IncidentDashboard />} />
          </Route>
          <Route path="/incidents" element={<IncidentLayout />}>
            <Route index element={<IncidentAdmin />} />
            <Route path=":id" element={<IncidentDetails />} />
          </Route>
          <Route path="/team" element={<IncidentLayout />}>
            <Route index element={<TeamManagement />} />
          </Route>
          <Route path="/status" element={<IncidentLayout />}>
            <Route index element={<IncidentStatusPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
