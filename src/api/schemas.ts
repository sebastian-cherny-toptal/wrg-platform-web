import { z } from "zod";

export const accessValueSchema = z.enum(["yes", "no"]);
export const entitlementSchema = z.record(z.string(), accessValueSchema);

export const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number().int(),
  organizationName: z.string(),
  entitlements: entitlementSchema,
});

export const sessionUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.email(),
  role: z.enum(["client", "admin"]),
  permissions: z.array(z.string()),
  programs: z.array(programSchema),
});

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
});

export const loginResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("authenticated"), session: sessionSchema }),
  z.object({
    status: z.literal("challenge_required"),
    challengeId: z.string(),
    methods: z.array(z.enum(["totp", "email", "recovery_code"])),
  }),
]);

export const demographicSchema = z.object({
  category: z.string(),
  group: z.enum(["personal", "workplace"]),
  values: z.array(
    z.object({ label: z.string(), count: z.number().int().nonnegative() }),
  ),
});

export const demographicResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(
    z.object({
      QuestionId: z.union([z.number().int(), z.string()]),
      category: z.string(),
      categoryLabel: z.string(),
      options: z.array(
        z.object({
          Caption: z.string(),
          Count: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});

const sectionResponseSchema = z.object({
  ResponseCaption: z.enum(["Agree", "Neutral", "Disagree"]),
  numberOfResponses: z.number().int().nonnegative(),
  percentOfAgreement: z.number().min(0).max(1).optional(),
  colorCode: z.string(),
  percent: z.number().min(0).max(1),
  percentage: z.number().int().min(0).max(100),
});

const sectionTotalsSchema = z.object({
  totalNumberOfQuestionsPerSection: z.number().int().nonnegative(),
  totalNumberOfResponsePerSection: z.number().int().nonnegative(),
  totalRespondents: z.number().int().nonnegative(),
  questionRange: z.array(z.union([z.string(), z.number()])),
});

export const employeeResponseBreakdownBySectionSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  isConfidential: z.boolean(),
  data: z.array(
    z.record(
      z.string(),
      z.array(z.union([sectionResponseSchema, sectionTotalsSchema])),
    ),
  ),
});

const questionResponseSchema = z.object({
  ResponseCaption: z.string(),
  numberOfResponses: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
  colorCode: z.string(),
});

export const employeeResponseBreakdownSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  isConfidential: z.boolean(),
  data: z.array(
    z.object({
      question: z.string(),
      questionId: z.string(),
      responses: z.array(questionResponseSchema),
    }),
  ),
});

export const heatMapPreviewResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  isConfidential: z.boolean().optional(),
  data: z.object({
    heatmapPreview: z.array(
      z.object({
        row: z.number().int().positive(),
        col: z.number().int().positive(),
        color: z.string(),
        value: z.union([z.number(), z.string()]),
      }),
    ),
    percentage: z.object({
      positivePercentage: z.number().min(0).max(100).optional(),
      neutralPercentage: z.number().min(0).max(100).optional(),
      negativePercentage: z.number().min(0).max(100).optional(),
      greenPercentage: z.number().min(0).max(100).optional(),
      bluePercentage: z.number().min(0).max(100).optional(),
      redPercentage: z.number().min(0).max(100).optional(),
    }),
  }),
});

const benchmarkValueSchema = z.union([z.number(), z.string()]);

export const workforceComparisonSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    tableHeaders: z.array(
      z.object({
        title: z.string(),
        type: z.string(),
        color: z.string(),
      }),
    ),
    data: z.array(
      z.object({
        title: z.string(),
        dataValues: z.array(benchmarkValueSchema),
        nestedData: z.array(
          z.object({
            id: z.union([z.string(), z.number()]).optional(),
            title: z.string(),
            dataValues: z.array(benchmarkValueSchema),
          }),
        ),
        legends: z.array(
          z.object({ color: z.string(), title: z.string() }),
        ),
      }),
    ),
    surveyAverage: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const comparisonQuestionsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    questionResponse: z.array(
      z.object({
        question: z.string(),
        currentOrg: z.number().min(0).max(100),
        otherOrg: z.number().min(0).max(100),
      }),
    ),
  }),
});

const annualDistributionSchema = z.object({
  ResponseCaption: z.enum(["Agree", "Neutral", "Disagree"]),
  numberOfResponses: z.number().int().nonnegative(),
  percent: z.number().min(0).max(1),
  percentage: z.number().int().min(0).max(100),
  colorCode: z.string(),
});

const annualSnapshotSchema = z.object({
  data: z.array(annualDistributionSchema),
  questionIds: z.array(z.string()),
});

export const annualResponseRateSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(z.record(z.string(), z.string())).nullable(),
});

export const annualCategoriesSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({ category: z.object({ category: z.string() }) }).catchall(
      z.union([annualSnapshotSchema, z.object({ category: z.string() })]),
    ),
  ),
});

const annualQuestionYearSchema = z.object({
  question: z.string(),
  questionId: z.string(),
  responses: z.array(annualDistributionSchema),
});

export const annualDetailsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  category: z.string(),
  data: z.array(
    z.object({ question: z.string(), questionId: z.string() }).catchall(
      z.union([z.string(), annualQuestionYearSchema]),
    ),
  ),
});

export const reportProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  available: z.boolean(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "draft", "archived"]),
  programs: z.number().int().nonnegative(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.email(),
  role: z.string(),
  status: z.enum(["active", "invited", "suspended"]),
});

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  users: z.number().int().nonnegative(),
  permissions: z.array(z.string()),
});

export const syncJobSchema = z.object({
  id: z.string(),
  source: z.enum(["zoho", "checkmarket"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  requestedAt: z.string(),
});

export type Program = z.infer<typeof programSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type LoginResult = z.infer<typeof loginResultSchema>;
export type Demographic = z.infer<typeof demographicSchema>;
export type EmployeeResponseBreakdownBySection = z.infer<
  typeof employeeResponseBreakdownBySectionSchema
>;
export type EmployeeResponseBreakdown = z.infer<
  typeof employeeResponseBreakdownSchema
>;
export type WorkforceComparison = z.infer<typeof workforceComparisonSchema>;
export type AnnualCategories = z.infer<typeof annualCategoriesSchema>;
export type ReportProduct = z.infer<typeof reportProductSchema>;
export type Project = z.infer<typeof projectSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type Role = z.infer<typeof roleSchema>;
export type SyncJob = z.infer<typeof syncJobSchema>;
