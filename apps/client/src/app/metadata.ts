import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  FileChartColumn,
  FileText,
  House,
  ShoppingBag,
} from 'lucide-react'

export const clientEntitlements = [
  'WFR_Access',
  'EV_Access',
  'WBC_Access',
  'BBP_Access',
  'RD_Access',
  'KIA_Access',
  'CR_Access',
] as const

export type ClientEntitlement = (typeof clientEntitlements)[number]
export type AccessRole = 'public' | 'guest' | 'client'

export type RouteMetadata = {
  id: string
  path: string
  title: string
  access: AccessRole
  nav?: 'client'
  entitlement?: ClientEntitlement
  icon?: LucideIcon
  legacyAliases?: readonly string[]
}

export const routeMap = {
  home: '/',
  clientLogin: '/login',
  adminPreview: '/admin-preview',
  dashboard: '/dashboard',
  programs: '/programs',
  wfr: '/employee-response-breakdown',
  detailedResults: '/detailed-results',
  responsePatterns: '/response-patterns',
  annualTrends: '/annual-trends',
  employeeVerbatims: '/employee-verbatims',
  benchmarkData: '/workforce-benchmark-comparisons',
  comparisonData: '/comparison-data',
  benefitsBestPractices: '/benefits-and-best-practices',
  responseDetail: '/response-detail',
  keyImpactAnalysis: '/key-impact-analysis',
  customReports: '/my-reports',
  catalog: '/reports-store',
  cart: '/reports/cart',
  checkout: '/reports/checkout',
  forbidden: '/forbidden',
} as const

export const routeMetadata: readonly RouteMetadata[] = [
  { id: 'home', path: routeMap.home, title: 'Home', access: 'public' },
  { id: 'client-login', path: routeMap.clientLogin, title: 'Client login', access: 'guest' },
  {
    id: 'dashboard',
    path: routeMap.dashboard,
    title: 'Dashboard',
    access: 'client',
    nav: 'client',
    icon: House,
  },
  { id: 'programs', path: routeMap.programs, title: 'Programs', access: 'client' },
  {
    id: 'wfr',
    path: routeMap.wfr,
    title: 'Workforce Feedback',
    access: 'client',
    nav: 'client',
    entitlement: 'WFR_Access',
    icon: BarChart3,
    legacyAliases: ['/reports/workforce-feedback'],
  },
  {
    id: 'detailed-results',
    path: routeMap.detailedResults,
    title: 'Detailed Results',
    access: 'client',
    entitlement: 'WFR_Access',
    icon: FileChartColumn,
  },
  {
    id: 'response-patterns',
    path: routeMap.responsePatterns,
    title: 'Response Patterns',
    access: 'client',
    entitlement: 'WFR_Access',
    icon: FileChartColumn,
  },
  {
    id: 'annual-trends',
    path: routeMap.annualTrends,
    title: 'Annual Trends',
    access: 'client',
    entitlement: 'WFR_Access',
    icon: FileChartColumn,
  },
  {
    id: 'employee-verbatims',
    path: routeMap.employeeVerbatims,
    title: 'Employee Verbatims',
    access: 'client',
    entitlement: 'EV_Access',
    icon: FileText,
  },
  {
    id: 'benchmark-data',
    path: routeMap.benchmarkData,
    title: 'Benchmark Data',
    access: 'client',
    entitlement: 'WBC_Access',
    icon: BarChart3,
  },
  {
    id: 'comparison-data',
    path: routeMap.comparisonData,
    title: 'Comparison Data',
    access: 'client',
    entitlement: 'WBC_Access',
    icon: BarChart3,
  },
  {
    id: 'benefits-best-practices',
    path: routeMap.benefitsBestPractices,
    title: 'Benefits & Best Practices',
    access: 'client',
    entitlement: 'BBP_Access',
    icon: FileChartColumn,
  },
  {
    id: 'response-detail',
    path: routeMap.responseDetail,
    title: 'Response Detail',
    access: 'client',
    entitlement: 'RD_Access',
    icon: FileChartColumn,
  },
  {
    id: 'key-impact-analysis',
    path: routeMap.keyImpactAnalysis,
    title: 'Key Impact Analysis',
    access: 'client',
    entitlement: 'KIA_Access',
    icon: FileChartColumn,
  },
  {
    id: 'custom-reports',
    path: routeMap.customReports,
    title: 'Custom Reports',
    access: 'client',
    entitlement: 'CR_Access',
    icon: FileText,
    legacyAliases: ['/custom-reporting'],
  },
  {
    id: 'catalog',
    path: routeMap.catalog,
    title: 'Reports store',
    access: 'client',
    nav: 'client',
    icon: ShoppingBag,
    legacyAliases: ['/reports/catalog'],
  },
  { id: 'cart', path: routeMap.cart, title: 'Cart', access: 'client' },
  { id: 'checkout', path: routeMap.checkout, title: 'Checkout', access: 'client' },
] as const
