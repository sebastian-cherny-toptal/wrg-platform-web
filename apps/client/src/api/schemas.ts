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
  role: z.literal("client"),
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

const legacyProgramReferenceSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  Name: z.string().optional(),
  name: z.string().optional(),
  Program_Year: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
});

export const legacyClientLoginSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().min(1),
    userData: z.object({
      _id: z.string().optional(),
      id: z.string().optional(),
      email: z.email(),
      fullName: z.string(),
      organizationId: z.object({
        Account_Name: z.string().optional(),
        name: z.string().optional(),
      }),
      organizationProgram: z.array(
        z.object({
          reportAccess: z.record(z.string(), z.unknown()),
          programId: legacyProgramReferenceSchema,
        }),
      ),
    }),
  }),
});

const dashboardPercentageSchema = z
  .union([z.number(), z.string()])
  .transform((value, context) => {
    const percentage = Number(value);
    if (!Number.isFinite(percentage)) {
      context.addIssue({
        code: "custom",
        message: "Expected a numeric percentage",
      });
      return z.NEVER;
    }
    return percentage;
  });

export const dashboardResponseRateSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    sendSurvey: z.number().nonnegative(),
    completedSurvey: z.number().nonnegative(),
    responseRate: z.number().nonnegative(),
    Total_Number_of_Program_EEs: z.number().nonnegative(),
    Total_Number_of_National_EEs: z.number().nonnegative(),
  }),
});

export const dashboardAgreementSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    percentage: dashboardPercentageSchema,
    negativePercentage: dashboardPercentageSchema,
    totalRespondents: z.number().int().nonnegative(),
    StartDate: z.string().nullable(),
    EndDate: z.string().nullable(),
    numberOfQuestions: z.number().int().nonnegative(),
  }),
});

const dashboardStatementSchema = z.object({
  title: z.string(),
  percentage: z.number().nonnegative(),
});

export const dashboardStatementsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    top: z.array(dashboardStatementSchema),
    bottom: z.array(dashboardStatementSchema),
    noteTop: z.string(),
    noteBottom: z.string(),
  }),
});

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
          Position: z.number().int().positive(),
        }),
      ),
    }),
  ),
});

const surveyFilterOptionSchema = z.object({
  Caption: z.string(),
  ResponseId: z.union([z.string(), z.number()]).optional(),
});

export const surveyFiltersResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(
    z.object({
      QuestionId: z.union([z.number().int(), z.string()]),
      filterLabel: z.string(),
      type: z.string().optional(),
      filterOption: z.union([
        z.array(surveyFilterOptionSchema),
        z.record(z.string(), z.array(z.string())),
      ]),
    }),
  ),
});

const sectionResponseSchema = z.object({
  ResponseCaption: z.enum(["Agree", "Neutral", "Disagree"]),
  numberOfResponses: z.number().int().nonnegative(),
  percentOfAgreement: z.number().min(0).max(1).optional(),
  colorCode: z.string(),
  percent: z.number().min(0).max(1),
  percentage: z.number().min(0).max(100),
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
        legends: z.array(z.object({ color: z.string(), title: z.string() })),
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

export const openResponseQuestionsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(
    z.object({
      caption: z.string(),
      id: z.union([z.string(), z.number()]),
      _id: z.string().optional(),
      questionNumber: z.number().optional(),
    }),
  ),
});

export const openResponseAnswersSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    respondentData: z.array(
      z.object({
        _id: z.string().optional(),
        RespondentId: z.union([z.string(), z.number()]).optional(),
        responses: z.object({
          QuestionId: z.union([z.string(), z.number()]).optional(),
          DataLabel: z.string().nullable().optional(),
          Value: z.string(),
          ResponseCaption: z.string().optional(),
        }),
      }),
    ),
    dataLen: z.number().int().nonnegative().optional(),
    queryQuestion: z.object({
      Caption: z.string(),
      Id: z.union([z.string(), z.number()]),
      DataLabel: z.string().nullable().optional(),
    }),
  }),
});

type EmployerBenchmarkNode = {
  id?: string | number | undefined;
  title: string;
  type?: string | undefined;
  dataValues?: (number | string)[] | undefined;
  nestedData?: EmployerBenchmarkNode[] | undefined;
};

const employerBenchmarkNodeSchema: z.ZodType<EmployerBenchmarkNode> = z.lazy(
  () =>
    z.object({
      id: z.union([z.string(), z.number()]).optional(),
      title: z.string(),
      type: z.string().optional(),
      dataValues: z.array(z.union([z.number(), z.string()])).optional(),
      nestedData: z.array(employerBenchmarkNodeSchema).optional(),
    }),
);

export const employerBenchmarkSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    tableHeaders: z.array(
      z.object({
        title: z.string(),
        subTitle: z.string().optional(),
        type: z.string().optional(),
        color: z.string().optional(),
      }),
    ),
    tableData: z.array(
      z.object({
        title: z.string(),
        nestedData: z.array(employerBenchmarkNodeSchema),
      }),
    ),
  }),
});

export const responseDetailSectionsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(
    z.record(
      z.string(),
      z.array(
        z.object({
          QuestionId: z.union([z.string(), z.number()]),
          Caption: z.string(),
        }),
      ),
    ),
  ),
});

const responseDetailCellSchema = z.union([
  z.string(),
  z.number(),
  z.object({
    percentile: z.string().optional(),
    average: z.string().optional(),
    respondentCount: z.number().int().nonnegative(),
  }),
]);

export const responseDetailResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(z.array(responseDetailCellSchema)),
});

export const customReportsSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(
    z
      .object({
        _id: z.string(),
        ReportTitle: z.string(),
        ReportDescription: z.string(),
        createAt: z.union([z.string(), z.date()]).optional(),
        createdAt: z.union([z.string(), z.date()]).optional(),
        reportFormats: z
          .array(
            z.object({
              _id: z.string().optional(),
              fileName: z.string().optional(),
              filename: z.string().optional(),
              fileUrl: z.string().optional(),
              signedUrl: z.string().optional(),
              url: z.string().optional(),
            }),
          )
          .default([]),
      })
      .passthrough(),
  ),
});

export const keyImpactAnalysisSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    _id: z.string().optional(),
    fileName: z.string().optional(),
    report: z.array(
      z.object({
        label: z.string(),
        key: z.string(),
        value: z.union([z.number(), z.string()]),
      }),
    ),
    data: z.object({ signedUrl: z.string().nullable().optional() }),
  }),
});

const annualDistributionSchema = z.object({
  ResponseCaption: z.enum(["Agree", "Neutral", "Disagree"]),
  numberOfResponses: z.number().int().nonnegative(),
  percent: z.number().min(0).max(1),
  percentage: z.number().min(0).max(100),
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
    z
      .object({ category: z.object({ category: z.string() }) })
      .catchall(
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
    z
      .object({ question: z.string(), questionId: z.string() })
      .catchall(z.union([z.string(), annualQuestionYearSchema])),
  ),
});

export const reportProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  available: z.boolean(),
});

export const paymentIntentSchema = z.object({
  client_secret: z.string().min(1),
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
