import { Navigate, Route, Routes } from 'react-router-dom'
import {
  ActivityLogPage,
  AdminShell,
  LoginSessionsPage,
  OrderLogPage,
  PortalUsersPage,
  ProgramDetailPage,
  ProjectDetailPage,
  ProjectsPage,
  RolesPage,
  UsersManagementPage,
} from './admin'
import { ForgotPasswordPage, LoginPage, ProtectedRoute, ResetPasswordPage, TwoFactorPage } from './auth'

export function App() {
  return <Routes>
    <Route path="/" element={<Navigate replace to="/admin-login" />} />
    <Route path="/admin-login" element={<LoginPage />} />
    <Route path="/admin/login" element={<Navigate replace to="/admin-login" />} />
    <Route path="/admin/2FA" element={<TwoFactorPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/admin" element={<ProtectedRoute><AdminShell /></ProtectedRoute>}>
      <Route index element={<Navigate replace to="projects" />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="projects/:projectId/programs/:programId" element={<ProgramDetailPage />} />
      <Route path="users" element={<PortalUsersPage />} />
      <Route path="users-management" element={<UsersManagementPage />} />
      <Route path="order-log" element={<OrderLogPage />} />
      <Route path="system-log" element={<ActivityLogPage />} />
      <Route path="user-login-sessions" element={<LoginSessionsPage />} />
      <Route path="role-permissions" element={<RolesPage />} />
    </Route>
    <Route path="*" element={<Navigate replace to="/admin-login" />} />
  </Routes>
}
