import type {
  Program,
  ReportProduct,
  Session,
} from '../api/schemas'

export const programs: Program[] = [
  {
    id: 'demo-workplace-2025',
    name: 'Best Places to Work in Money Management 2025',
    year: 2025,
    organizationName: 'Cohen & Steers',
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
    id: 'demo-workplace-2024',
    name: 'Best Places to Work in Money Management 2024',
    year: 2024,
    organizationName: 'Cohen & Steers',
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
]

export const clientSession: Session = {
  user: {
    id: 'demo-user',
    displayName: 'Demo User',
    email: 'demo.user@example.com',
    role: 'client',
    permissions: [],
    programs,
  },
  expiresAt: '2099-12-31T23:59:59.000Z',
  verifiedAt: '2026-07-28T00:00:00.000Z',
  impersonation: null,
}

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
    priceCents: 42500,
    available: true,
  },
  {
    id: 'report-kia',
    name: 'Key Impact Analysis',
    description:
      'Identify the workplace attributes most important to retaining top talent and driving productivity. Delivery is typically within 7–10 business days.',
    priceCents: 82000,
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
