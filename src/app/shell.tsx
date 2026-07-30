import {
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  ShoppingBag,
  ShoppingCart,
  UserRoundX,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { WorkforceLogoWhite } from '../components/branding/workforce-logo-white'
import { routeMap, routeMetadata } from './metadata'
import { hasEntitlement, hasPermission, useAppStore } from '../store/app-store'
import { Button, cn } from '../components/ui'

type ClientLink = {
  title: string
  path: string
  entitlement?: Parameters<typeof hasEntitlement>[0]
}

const workforceFeedbackLinks: ClientLink[] = [
  { title: 'Employee Response Breakdown', path: routeMap.wfr, entitlement: 'WFR_Access' },
  { title: 'Detailed Results', path: routeMap.detailedResults, entitlement: 'WFR_Access' },
  { title: 'Response Patterns', path: routeMap.responsePatterns, entitlement: 'WFR_Access' },
  { title: 'Annual Trends', path: routeMap.annualTrends, entitlement: 'WFR_Access' },
]

const benchmarkLinks: ClientLink[] = [
  { title: 'Benchmark Data', path: routeMap.benchmarkData, entitlement: 'WBC_Access' },
  { title: 'Comparison Data', path: routeMap.comparisonData, entitlement: 'WBC_Access' },
]

const additionalLinks: ClientLink[] = [
  { title: 'Response Detail', path: routeMap.responseDetail, entitlement: 'RD_Access' },
  { title: 'Key Impact Analysis', path: routeMap.keyImpactAnalysis, entitlement: 'KIA_Access' },
  { title: 'Custom Reports', path: routeMap.customReports, entitlement: 'CR_Access' },
]

const isClientLinkVisible = (link: ClientLink) => !link.entitlement || hasEntitlement(link.entitlement)

function SidebarLink({
  to,
  children,
  nested = false,
  onNavigate,
}: {
  to: string
  children: ReactNode
  nested?: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      end
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white',
          nested && 'min-h-8 py-1.5 pl-3 text-[13px] font-normal text-zinc-400',
          isActive && 'bg-violet-600 text-white hover:bg-violet-600',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function ReportGroup({
  title,
  links,
  locationPath,
  onNavigate,
}: {
  title: string
  links: ClientLink[]
  locationPath: string
  onNavigate: () => void
}) {
  const visibleLinks = links.filter(isClientLinkVisible)
  if (!visibleLinks.length) return null
  const active = visibleLinks.some((link) => locationPath === link.path)
  return (
    <details className="group" open={active || title === 'Workforce Feedback Results'}>
      <summary
        className={cn(
          'flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm text-zinc-400 hover:text-white',
          active && 'text-zinc-200',
        )}
      >
        <span className="flex size-4 items-center justify-center text-lg font-light">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:block">−</span>
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </summary>
      <div className="ml-3 border-l border-zinc-600 pl-2">
        {visibleLinks.map((link) => (
          <SidebarLink key={link.path} nested onNavigate={onNavigate} to={link.path}>
            {link.title}
          </SidebarLink>
        ))}
      </div>
    </details>
  )
}

function ClientSidebar({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation()
  const directBasicLinks: ClientLink[] = [
    { title: 'Employee Verbatims', path: routeMap.employeeVerbatims, entitlement: 'EV_Access' },
    { title: 'Benefits & Best Practices', path: routeMap.benefitsBestPractices, entitlement: 'BBP_Access' },
  ]
  return (
    <nav className="grid gap-1" aria-label="Primary navigation">
      <SidebarLink onNavigate={onNavigate} to={routeMap.dashboard}>
        <Home className="size-4" /> Dashboard
      </SidebarLink>

      <details className="group mt-1" open>
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
          <FileText className="size-4" />
          <span className="flex-1">My Reports</span>
          <ChevronDown className="hidden size-4 group-open:block" />
          <ChevronRight className="size-4 group-open:hidden" />
        </summary>
        <div className="ml-4 mt-1 grid gap-1">
          <p className="mb-1 mt-2 px-2 text-xs font-medium tracking-wide text-violet-400">BASIC PACKAGE</p>
          <ReportGroup
            links={workforceFeedbackLinks}
            locationPath={location.pathname}
            onNavigate={onNavigate}
            title="Workforce Feedback Results"
          />
          {directBasicLinks.slice(0, 1).map((link) =>
            isClientLinkVisible(link) ? (
              <SidebarLink key={link.path} nested onNavigate={onNavigate} to={link.path}>{link.title}</SidebarLink>
            ) : null,
          )}
          <ReportGroup
            links={benchmarkLinks}
            locationPath={location.pathname}
            onNavigate={onNavigate}
            title="Workforce Benchmark Comparisons"
          />
          {directBasicLinks.slice(1).map((link) =>
            isClientLinkVisible(link) ? (
              <SidebarLink key={link.path} nested onNavigate={onNavigate} to={link.path}>{link.title}</SidebarLink>
            ) : null,
          )}

          <p className="mb-1 mt-3 px-2 text-xs font-medium tracking-wide text-violet-400">ADDITIONAL REPORTS</p>
          {additionalLinks.filter(isClientLinkVisible).map((link) => (
            <SidebarLink key={link.path} nested onNavigate={onNavigate} to={link.path}>{link.title}</SidebarLink>
          ))}
        </div>
      </details>

      <SidebarLink onNavigate={onNavigate} to={routeMap.catalog}>
        <ShoppingBag className="size-4" /> Reports Store
      </SidebarLink>
    </nav>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setSession = useAppStore((state) => state.setSession)
  const cartCount = useAppStore((state) => state.cart.reduce((total, item) => total + item.quantity, 0))
  const navKind = session?.user.role
  const adminNavItems = routeMetadata.filter(
    (route) =>
      route.nav === 'admin' &&
      (!route.permission || hasPermission(route.permission)),
  )

  const logout = async () => {
    await api.session.logout()
    setSession(null)
    await navigate(routeMap.clientLogin)
  }

  const stopImpersonation = async () => {
    const restored = await api.session.stopImpersonation()
    setSession(restored)
    await navigate(routeMap.adminProjects)
  }

  if (!session) return <Outlet />

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900 lg:flex">
      {session.impersonation ? (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950">
          Viewing as {session.user.displayName}; verified administrator: {session.impersonation.actorDisplayName}
          <Button variant="ghost" className="h-7 bg-amber-100 px-2" onClick={() => void stopImpersonation()}>
            <UserRoundX className="mr-1 size-4" /> Stop
          </Button>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 flex h-[72px] items-center bg-[#171717] px-5 text-white lg:hidden">
        <WorkforceLogoWhite className="w-40" />
        <div className="ml-auto flex items-center gap-2">
          {navKind === 'client' ? (
            <NavLink className="relative p-2" to={routeMap.cart} aria-label={`Cart with ${cartCount} items`}>
              <ShoppingCart className="size-5" />
              {cartCount ? <span className="absolute right-0 top-0 rounded-full bg-violet-600 px-1.5 text-[10px] font-bold">{cartCount}</span> : null}
            </NavLink>
          ) : null}
          <button className="p-2" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[310px] flex-col border-r border-zinc-800 bg-[#171717] text-white lg:sticky lg:top-0 lg:h-screen lg:flex',
          menuOpen ? 'flex' : 'hidden',
        )}
      >
        <div className="flex h-[72px] items-center border-b border-zinc-800 px-5">
          <NavLink to={navKind === 'admin' ? routeMap.adminProjects : routeMap.dashboard} onClick={() => setMenuOpen(false)}>
            <WorkforceLogoWhite className="w-48" />
          </NavLink>
          <button className="ml-auto p-2 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {navKind === 'client' ? (
            <ClientSidebar onNavigate={() => setMenuOpen(false)} />
          ) : (
            <nav className="grid gap-1" aria-label="Primary navigation">
              {adminNavItems.map(({ id, path, title, icon: Icon }) => (
                <SidebarLink key={id} onNavigate={() => setMenuOpen(false)} to={path}>
                  {Icon ? <Icon className="size-4" /> : null}{title}
                </SidebarLink>
              ))}
            </nav>
          )}
        </div>

        <div className="relative border-t border-zinc-800 p-3">
          {profileOpen ? (
            <div className="absolute bottom-[72px] left-3 right-3 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => void logout()}>
                <LogOut className="size-4" /> Logout
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-lg p-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-sm font-semibold">
              {session.user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-300">{session.user.displayName}</p>
              <p className="truncate text-xs text-zinc-500">{session.user.email}</p>
            </div>
            <button className="p-1 text-zinc-500 hover:text-white" onClick={() => setProfileOpen((value) => !value)} aria-label="Open profile menu">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-[#f7f7f8]">
        <Outlet />
        <footer className="border-t border-zinc-200 bg-white px-6 py-3 text-xs text-zinc-500">
          © Workforce Research Group · Feedback Data Dashboard
        </footer>
      </main>
    </div>
  )
}
