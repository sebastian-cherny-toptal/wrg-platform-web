import type { Page } from '@playwright/test'

const programId = 'demo-program-2026'
export const clientFixtureUsername = process.env.VITE_TEST_USERNAME ?? 'demo-client'

export async function installClientApiFixture(page: Page, options: { dashboard?: boolean; role?: 'client' | 'Promotional' } = {}) {
  await page.route('**/user/login', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: 'e2e-access-token',
          userData: {
            id: 'demo-client',
            email: 'client@example.invalid',
            fullName: 'Demo Client',
            role: options.role ?? 'client',
            organizationId: { Account_Name: 'Demo Organization' },
            organizationProgram: [
              {
                programId: { id: programId, name: 'Demo Program', year: 2026 },
                reportAccess: {
                  WFR_Access: 'yes',
                  EV_Access: 'yes',
                  WBC_Access: 'yes',
                  BBP_Access: 'yes',
                  RD_Access: 'yes',
                  KIA_Access: 'yes',
                  CR_Access: 'yes',
                },
              },
            ],
          },
        },
      }),
    })
  })

  if (!options.dashboard) return

  await page.route('**/client/averagePercentageOfAgreement?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'success',
        data: {
          percentage: 83,
          negativePercentage: 5,
          totalRespondents: 199,
          StartDate: '2026-01-01',
          EndDate: '2026-01-31',
          numberOfQuestions: 10,
        },
      }),
    })
  })
  await page.route('**/client/surveyResponseRate?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'success',
        data: {
          sendSurvey: 410,
          completedSurvey: 199,
          responseRate: 49,
          Total_Number_of_Program_EEs: 410,
          Total_Number_of_National_EEs: 410,
        },
      }),
    })
  })
  await page.route('**/client/dashboardTopBottomStatements?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'success',
        data: {
          top: [{ title: 'Top statement', percentage: 90 }],
          bottom: [{ title: 'Bottom statement', percentage: 60 }],
          noteTop: 'Top statement note',
          noteBottom: 'Bottom statement note',
        },
      }),
    })
  })
}
