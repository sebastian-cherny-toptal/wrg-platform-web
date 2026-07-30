import { z } from 'zod'

export const accessValueSchema = z.enum(['yes', 'no'])
export const entitlementSchema = z.record(z.string(), accessValueSchema)

export const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number().int(),
  organizationName: z.string(),
  entitlements: entitlementSchema,
})

export const sessionUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.email(),
  role: z.enum(['client', 'admin']),
  permissions: z.array(z.string()),
  programs: z.array(programSchema),
})

export const sessionSchema = z.object({
  user: sessionUserSchema,
  expiresAt: z.string(),
  verifiedAt: z.string(),
  impersonation: z
    .object({
      actorId: z.string(),
      actorDisplayName: z.string(),
      reason: z.string(),
      startedAt: z.string(),
    })
    .nullable(),
})

export const loginResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('authenticated'), session: sessionSchema }),
  z.object({
    status: z.literal('challenge_required'),
    challengeId: z.string(),
    methods: z.array(z.enum(['totp', 'email', 'recovery_code'])),
  }),
])

export const demographicSchema = z.object({
  category: z.string(),
  group: z.enum(['personal', 'workplace']),
  values: z.array(z.object({ label: z.string(), count: z.number().int().nonnegative() })),
})

export const reportProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  available: z.boolean(),
})

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'draft', 'archived']),
  programs: z.number().int().nonnegative(),
})

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.email(),
  role: z.string(),
  status: z.enum(['active', 'invited', 'suspended']),
})

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  users: z.number().int().nonnegative(),
  permissions: z.array(z.string()),
})

export const syncJobSchema = z.object({
  id: z.string(),
  source: z.enum(['zoho', 'checkmarket']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  requestedAt: z.string(),
})

export type Program = z.infer<typeof programSchema>
export type Session = z.infer<typeof sessionSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type Demographic = z.infer<typeof demographicSchema>
export type ReportProduct = z.infer<typeof reportProductSchema>
export type Project = z.infer<typeof projectSchema>
export type AdminUser = z.infer<typeof adminUserSchema>
export type Role = z.infer<typeof roleSchema>
export type SyncJob = z.infer<typeof syncJobSchema>
