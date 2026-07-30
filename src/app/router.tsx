import { Navigate, Outlet, createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import type { AccessRole, AdminPermission, ClientEntitlement } from './metadata'
import { routeMap } from './metadata'
import { AppShell } from './shell'
import { hasEntitlement, hasPermission, useAppStore } from '../store/app-store'
import { AdminLoginPage, ClientLoginPage, RecoveryPage, TwoFactorPage } from '../pages/auth'
import { CartPage, CatalogPage, CheckoutPage, DashboardPage, ProgramsPage, WorkforceFeedbackPage } from '../pages/client'
import {
  AnnualTrendsPage,
  BenefitsBestPracticesPage,
  BenchmarkDataPage,
  ComparisonDataPage,
  CustomReportsPage,
  DetailedResultsPage,
  EmployeeVerbatimsPage,
  KeyImpactAnalysisPage,
  ResponseDetailPage,
  ResponsePatternsPage,
} from '../pages/client-reports'
import { ProjectsPage, RolesPage, SyncJobsPage, UsersPage } from '../pages/admin'
import { Button, StatePanel } from '../components/ui'

function Guard({
  role,
  entitlement,
  permission,
}: {
  role: AccessRole
  entitlement?: ClientEntitlement
  permission?: AdminPermission
}) {
  const session = useAppStore((state) => state.session)
  if (role === 'guest' && session) return <Navigate replace to={session.user.role === 'admin' ? routeMap.adminProjects : routeMap.dashboard} />
  if (role === 'client' && !session) return <Navigate replace to={routeMap.clientLogin} />
  if (role === 'admin' && !session) return <Navigate replace to={routeMap.adminLogin} />
  if (role === 'client' && session?.user.role !== 'client' && session?.impersonation === null) return <Navigate replace to={routeMap.adminProjects} />
  if (role === 'admin' && session?.user.role !== 'admin') return <Navigate replace to={routeMap.forbidden} />
  if (entitlement && !hasEntitlement(entitlement)) return <Navigate replace to={routeMap.forbidden} />
  if (permission && !hasPermission(permission)) return <Navigate replace to={routeMap.forbidden} />
  return <Outlet />
}

function ForbiddenPage() {
  return <div className="p-8"><StatePanel kind="error" title="Access unavailable" message="Your selected program or role does not include access to this area." action={<Button onClick={() => history.back()}>Go back</Button>} /></div>
}

function NotFoundPage() {
  return <div className="p-8"><StatePanel kind="empty" title="Page not found" message="The requested page does not exist in this platform." /></div>
}

function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unexpected application error'
  return <div className="p-8"><StatePanel kind="error" title="Something went wrong" message={message} /></div>
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: routeMap.home, element: <Navigate replace to={routeMap.clientLogin} /> },
      {
        element: <Guard role="guest" />,
        children: [
          { path: routeMap.clientLogin, element: <ClientLoginPage /> },
          { path: routeMap.adminLogin, element: <AdminLoginPage /> },
          { path: '/admin/login', element: <Navigate replace to={routeMap.adminLogin} /> },
          { path: routeMap.twoFactor, element: <TwoFactorPage /> },
          { path: '/auth/2fa', element: <Navigate replace to={routeMap.twoFactor} /> },
          { path: routeMap.recovery, element: <RecoveryPage /> },
          { path: '/auth/recovery', element: <Navigate replace to={routeMap.recovery} /> },
        ],
      },
      {
        element: <Guard role="client" />,
        children: [
          { path: routeMap.dashboard, element: <DashboardPage /> },
          { path: routeMap.programs, element: <ProgramsPage /> },
          {
            element: <Guard role="client" entitlement="WFR_Access" />,
            children: [
              { path: routeMap.wfr, element: <WorkforceFeedbackPage /> },
              { path: '/employee-response-breakdown', element: <Navigate replace to={routeMap.wfr} /> },
              { path: routeMap.detailedResults, element: <DetailedResultsPage /> },
              { path: routeMap.responsePatterns, element: <ResponsePatternsPage /> },
              { path: routeMap.annualTrends, element: <AnnualTrendsPage /> },
            ],
          },
          {
            element: <Guard role="client" entitlement="EV_Access" />,
            children: [{ path: routeMap.employeeVerbatims, element: <EmployeeVerbatimsPage /> }],
          },
          {
            element: <Guard role="client" entitlement="WBC_Access" />,
            children: [
              { path: routeMap.benchmarkData, element: <BenchmarkDataPage /> },
              { path: routeMap.comparisonData, element: <ComparisonDataPage /> },
            ],
          },
          {
            element: <Guard role="client" entitlement="BBP_Access" />,
            children: [{ path: routeMap.benefitsBestPractices, element: <BenefitsBestPracticesPage /> }],
          },
          {
            element: <Guard role="client" entitlement="RD_Access" />,
            children: [{ path: routeMap.responseDetail, element: <ResponseDetailPage /> }],
          },
          {
            element: <Guard role="client" entitlement="KIA_Access" />,
            children: [{ path: routeMap.keyImpactAnalysis, element: <KeyImpactAnalysisPage /> }],
          },
          {
            element: <Guard role="client" entitlement="CR_Access" />,
            children: [
              { path: routeMap.customReports, element: <CustomReportsPage /> },
              { path: '/custom-reporting', element: <Navigate replace to={routeMap.customReports} /> },
            ],
          },
          { path: routeMap.catalog, element: <CatalogPage /> },
          { path: '/reports-store', element: <Navigate replace to={routeMap.catalog} /> },
          { path: routeMap.cart, element: <CartPage /> },
          { path: routeMap.checkout, element: <CheckoutPage /> },
        ],
      },
      {
        element: <Guard role="admin" />,
        children: [
          {
            element: <Guard role="admin" permission="clientsProjectsProgramsAccess" />,
            children: [{ path: routeMap.adminProjects, element: <ProjectsPage /> }],
          },
          { path: routeMap.adminUsers, element: <UsersPage /> },
          { path: routeMap.adminRoles, element: <RolesPage /> },
          { path: '/admin/role-permissions', element: <Navigate replace to={routeMap.adminRoles} /> },
          {
            element: <Guard role="admin" permission="syncCheckmartketAndZohoAccess" />,
            children: [{ path: routeMap.adminSyncJobs, element: <SyncJobsPage /> }],
          },
        ],
      },
      { path: routeMap.forbidden, element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
