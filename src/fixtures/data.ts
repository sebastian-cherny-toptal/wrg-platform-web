import type {
  AdminUser,
  Demographic,
  Program,
  Project,
  ReportProduct,
  Role,
  Session,
  SyncJob,
} from '../api/schemas'

export const programs: Program[] = [
  {
    id: 'program-demo-2026',
    name: 'Workplace Insights 2026',
    year: 2026,
    organizationName: 'Northstar Demo Cooperative',
    entitlements: {
      WFR_Access: 'yes',
      EV_Access: 'yes',
      WBC_Access: 'yes',
      BBP_Access: 'yes',
      RD_Access: 'yes',
      KIA_Access: 'yes',
      CR_Access: 'yes',
    },
  },
  {
    id: 'program-demo-2025',
    name: 'Workplace Insights 2025',
    year: 2025,
    organizationName: 'Northstar Demo Cooperative',
    entitlements: {
      WFR_Access: 'yes',
      EV_Access: 'no',
      WBC_Access: 'yes',
      BBP_Access: 'yes',
      RD_Access: 'no',
      KIA_Access: 'no',
      CR_Access: 'yes',
    },
  },
]

export const clientSession: Session = {
  user: {
    id: 'user-demo-client',
    displayName: 'Demo Client',
    email: 'client@example.invalid',
    role: 'client',
    permissions: [],
    programs,
  },
  expiresAt: '2099-12-31T23:59:59.000Z',
  verifiedAt: '2026-07-28T00:00:00.000Z',
  impersonation: null,
}

export const adminSession: Session = {
  user: {
    id: 'user-demo-admin',
    displayName: 'Demo Administrator',
    email: 'admin@example.invalid',
    role: 'admin',
    permissions: [
      'clientsProjectsProgramsAccess',
      'syncCheckmartketAndZohoAccess',
      'previewClientsDashboardAccess',
      'exportReportsAccess',
    ],
    programs: [],
  },
  expiresAt: '2099-12-31T23:59:59.000Z',
  verifiedAt: '2026-07-28T00:00:00.000Z',
  impersonation: null,
}

export const demographics: Demographic[] = [
  {
    category: 'Age generation',
    group: 'personal',
    values: [
      { label: 'Generation Z', count: 48 },
      { label: 'Millennial', count: 121 },
      { label: 'Generation X', count: 94 },
    ],
  },
  {
    category: 'Job status',
    group: 'workplace',
    values: [
      { label: 'Full time', count: 223 },
      { label: 'Part time', count: 40 },
    ],
  },
  {
    category: 'Workplace setting',
    group: 'workplace',
    values: [
      { label: 'On site', count: 136 },
      { label: 'Hybrid', count: 92 },
      { label: 'Remote', count: 35 },
    ],
  },
]

export const products: ReportProduct[] = [
  {
    id: 'report-dashboard',
    name: 'Employee Feedback Data Dashboard',
    description:
      'A complete interactive reporting package with survey consultation, Workforce Feedback Results, Employee Verbatims, Workforce Benchmark Comparisons, and Benefits & Best Practices.',
    priceCents: 100000,
    available: true,
  },
  {
    id: 'report-verbatims-sorted',
    name: 'Sorted Employee Verbatims',
    description:
      'Sort employees’ open-ended responses by a demographic to better identify where comments originated.',
    priceCents: 15000,
    available: true,
  },
  {
    id: 'report-kia',
    name: 'Key Impact Analysis',
    description:
      'Identify the workplace attributes most important to retaining top talent and driving productivity. Delivery is typically within 7–10 business days.',
    priceCents: 100000,
    available: true,
  },
  {
    id: 'report-response-detail',
    name: 'Response Detail Report',
    description:
      'Review the percentage of responses across the full six-point scale for each survey question and demographic.',
    priceCents: 100000,
    available: true,
  },
  {
    id: 'report-custom',
    name: 'Custom Reports',
    description:
      'More in-depth reporting tailored to your organization is available through the Workforce Research Group survey team.',
    priceCents: 0,
    available: false,
  },
  {
    id: 'report-resort',
    name: 'Re-Sorted Workforce Feedback Report',
    description:
      'Work with a Survey Professional to adjust demographic breakouts and obtain a more meaningful, actionable report.',
    priceCents: 0,
    available: false,
  },
]

export const projects: Project[] = [
  { id: 'project-aurora', name: 'Aurora 2026', status: 'active', programs: 4 },
  { id: 'project-lighthouse', name: 'Lighthouse Pilot', status: 'draft', programs: 2 },
]

export const adminUsers: AdminUser[] = [
  {
    id: 'admin-demo-1',
    displayName: 'Operations Demo',
    email: 'operations@example.invalid',
    role: 'Operations',
    status: 'active',
  },
  {
    id: 'admin-demo-2',
    displayName: 'Sales Demo',
    email: 'sales@example.invalid',
    role: 'Sales',
    status: 'invited',
  },
]

export const roles: Role[] = [
  { id: 'role-ops', name: 'Operations', users: 4, permissions: ['clientsProjectsProgramsAccess', 'exportReportsAccess'] },
  { id: 'role-sales', name: 'Sales', users: 2, permissions: ['clientsProjectsProgramsAccess', 'orderLogAccess'] },
]

export const syncJobs: SyncJob[] = [
  { id: 'sync-demo-1', source: 'zoho', status: 'succeeded', requestedAt: '2026-07-27T15:15:00.000Z' },
  { id: 'sync-demo-2', source: 'checkmarket', status: 'queued', requestedAt: '2026-07-28T00:05:00.000Z' },
]
