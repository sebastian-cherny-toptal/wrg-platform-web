import { useEffect } from 'react'
import { Navigate, Outlet, createBrowserRouter, isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom'
import type { AccessRole, ClientEntitlement } from './metadata'
import { routeMap } from './metadata'
import { AppShell } from './shell'
import { hasEntitlement, useAppStore } from '../store/app-store'
import { AdminPreviewPage, ClientLoginPage } from '../pages/auth'
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
import { Button, StatePanel } from '../components/ui'

function Guard({
  role,
  entitlement,
  allowPromotional = false,
}: {
  role: AccessRole
  entitlement?: ClientEntitlement
  allowPromotional?: boolean
}) {
  const session = useAppStore((state) => state.session)
  const location = useLocation()
  if (role === 'guest' && session) return <Navigate replace to={routeMap.dashboard} />
  if (role === 'client' && !session) return <Navigate replace to={routeMap.clientLogin} />
  const promotionalAccess = allowPromotional && session?.user.role === 'promotional'
  const demoProduct = new URLSearchParams(location.search).get('demo')
  const demoAccess =
    (entitlement === 'EV_Access' && demoProduct === 'report-verbatims-sorted') ||
    (entitlement === 'RD_Access' && demoProduct === 'report-response-detail')
  if (entitlement && !promotionalAccess && !demoAccess && !hasEntitlement(entitlement)) return <Navigate replace to={routeMap.forbidden} />
  return <Outlet />
}

function AdminAppRedirect() {
  const location = useLocation()
  useEffect(() => {
    const configured = import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5174/admin/projects'
    const adminOrigin = new URL(configured, window.location.origin).origin
    const path = location.pathname === '/admin-login' || location.pathname === '/admin/login'
      ? '/admin-login'
      : `${location.pathname}${location.search}`
    window.location.replace(new URL(path, adminOrigin).toString())
  }, [location.pathname, location.search])
  return <div className="p-8"><StatePanel kind="loading" title="Opening administration" message="Redirecting to the secure admin application." /></div>
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
      { path: '/admin-login', element: <AdminAppRedirect /> },
      { path: '/admin/login', element: <AdminAppRedirect /> },
      { path: '/admin/*', element: <AdminAppRedirect /> },
      {
        element: <Guard role="guest" />,
        children: [
          { path: routeMap.clientLogin, element: <ClientLoginPage /> },
          { path: routeMap.adminPreview, element: <AdminPreviewPage /> },
        ],
      },
      {
        element: <Guard role="client" />,
        children: [
          { path: routeMap.dashboard, element: <DashboardPage /> },
          { path: routeMap.programs, element: <ProgramsPage /> },
          {
            element: <Guard role="client" entitlement="WFR_Access" allowPromotional />,
            children: [
              { path: routeMap.wfr, element: <WorkforceFeedbackPage /> },
              { path: '/reports/workforce-feedback', element: <Navigate replace to={routeMap.wfr} /> },
            ],
          },
          {
            element: <Guard role="client" entitlement="WFR_Access" />,
            children: [
              { path: routeMap.detailedResults, element: <DetailedResultsPage /> },
              { path: routeMap.responsePatterns, element: <ResponsePatternsPage /> },
              { path: routeMap.annualTrends, element: <AnnualTrendsPage /> },
            ],
          },
          {
            element: <Guard role="client" entitlement="EV_Access" allowPromotional />,
            children: [{ path: routeMap.employeeVerbatims, element: <EmployeeVerbatimsPage /> }],
          },
          {
            element: <Guard role="client" entitlement="WBC_Access" allowPromotional />,
            children: [{ path: routeMap.benchmarkData, element: <BenchmarkDataPage /> }],
          },
          {
            element: <Guard role="client" entitlement="WBC_Access" />,
            children: [{ path: routeMap.comparisonData, element: <ComparisonDataPage /> }],
          },
          {
            element: <Guard role="client" entitlement="BBP_Access" allowPromotional />,
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
          { path: '/reports/catalog', element: <Navigate replace to={routeMap.catalog} /> },
          { path: routeMap.cart, element: <CartPage /> },
          { path: routeMap.checkout, element: <CheckoutPage /> },
        ],
      },
      { path: routeMap.forbidden, element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
