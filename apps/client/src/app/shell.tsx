import {
  ChevronDown,
  Gauge,
  Home,
  Menu,
  MoreHorizontal,
  ShoppingCart,
  Store,
  UserRoundX,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { WorkforceLogoWhite } from '@wrg/platform-ui'
import { routeMap } from './metadata'
import { PageViewLogger } from './page-view-logger'
import { hasEntitlement, useAppStore } from '../store/app-store'
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
          nested && 'min-h-8 py-1.5 pl-1 text-[13px] font-normal text-zinc-400',
          isActive && 'rounded-md bg-violet-600 text-white hover:bg-violet-600',
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
    <details className="group/report" open={active}>
      <summary
        className={cn(
          'flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm text-zinc-400 hover:text-white',
          active && 'text-zinc-200',
        )}
      >
        <span className="flex size-4 items-center justify-center text-lg font-light">
          <span className="group-open/report:hidden">+</span>
          <span className="hidden group-open/report:block">−</span>
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
    <nav className="grid gap-0" aria-label="Primary navigation">
      <SidebarLink onNavigate={onNavigate} to={routeMap.dashboard}>
        <Home className="size-4" /> Dashboard
      </SidebarLink>

      <details className="group/nav mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
          <Gauge className="size-4" />
          <span className="flex-1">My Reports</span>
          <ChevronDown className="size-4 transition-transform group-open/nav:rotate-180" />
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

      <div className="mt-2">
        <SidebarLink onNavigate={onNavigate} to={routeMap.catalog}>
          <Store className="size-4" /> Reports Store
        </SidebarLink>
      </div>
    </nav>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setSession = useAppStore((state) => state.setSession)
  const selectedProgramId = useAppStore((state) => state.selectedProgramId)
  const cartCount = useAppStore((state) => state.cart.reduce((total, item) => total + item.quantity, 0))

  const logout = async () => {
    await api.session.logout()
    setSession(null)
    await navigate(routeMap.clientLogin)
  }

  const stopImpersonation = async () => {
    await api.session.stopImpersonation()
    setSession(null)
    window.location.assign(import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5174/admin/projects')
  }

  if (!session) {
    return (
      <>
        <PageViewLogger />
        <Outlet />
      </>
    )
  }

  return (
    <>
      <PageViewLogger />
      <div className="h-screen overflow-hidden bg-[#f7f7f8] text-zinc-900 lg:flex">
      {session.impersonation ? (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-gradient-to-l from-[#EC413D] to-[#FF683A] px-6 py-1.5 text-sm font-bold uppercase text-white lg:left-[310px]">
          <span>Warning: Admin Access</span>
          <Button variant="ghost" className="h-7 bg-white/15 px-3 text-white hover:bg-white/25" onClick={() => void stopImpersonation()}>
            <UserRoundX className="mr-1 size-4" /> Return to admin
          </Button>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 flex h-[72px] items-center bg-[#171717] px-5 text-white lg:hidden">
        <WorkforceLogoWhite className="w-40" />
        <div className="ml-auto flex items-center gap-2">
          <NavLink className="relative p-2" to={routeMap.cart} aria-label={`Cart with ${cartCount} items`}>
            <ShoppingCart className="size-5" />
            {cartCount ? <span className="absolute right-0 top-0 rounded-full bg-violet-600 px-1.5 text-[10px] font-bold">{cartCount}</span> : null}
          </NavLink>
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
        <div className="flex h-[72px] items-center border-b border-zinc-800 px-2.5">
          <NavLink to={routeMap.dashboard} onClick={() => setMenuOpen(false)}>
            <WorkforceLogoWhite className="w-48" />
          </NavLink>
          <button className="ml-auto p-2 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <ClientSidebar key={selectedProgramId} onNavigate={() => setMenuOpen(false)} />
        </div>

        <div className="relative p-[10px]">
          {profileOpen ? (
            <div className="absolute bottom-[47px] right-[18px] w-[142px] overflow-hidden rounded-[3px] bg-white py-1 text-zinc-900 shadow-xl" role="menu">
              <button className="flex w-full items-center whitespace-nowrap px-4 py-2 text-left text-sm hover:bg-zinc-100" role="menuitem" onClick={() => window.location.reload()}>
                Use Clear Cache
              </button>
              <button className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-zinc-100" role="menuitem" onClick={() => void logout()}>
                Logout
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-lg p-2">
            <div className="grid size-[38px] shrink-0 place-items-center rounded-lg bg-zinc-800 text-sm font-semibold">
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

      <main className="flex h-full min-w-0 flex-1 flex-col bg-[#f7f7f8]">
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
        <footer className="flex h-11 shrink-0 items-center justify-between border-t border-zinc-200 bg-white pl-4 pr-5 text-[12px] text-zinc-500">
          <>
            <div className="flex items-center gap-3">
              <span>Workforce Research Group 2026 ©</span>
              <span>|</span>
              <a className="hover:text-violet-600" href="https://workforcerg.com/privacy-policy" target="_blank" rel="noreferrer">WRG Privacy Policy</a>
            </div>
            <span>(281) 602-5004 | answers@workforcerg.com</span>
          </>
        </footer>
      </main>
      </div>
    </>
  )
}
