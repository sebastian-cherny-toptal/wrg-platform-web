import { expect, test } from "@playwright/test";
import {
  clientFixtureUsername,
  installClientApiFixture,
} from "./support/client-api-fixture";

test("shows sticky cohorts and expands workbook percentages", async ({
  page,
}) => {
  await installClientApiFixture(page, { dashboard: true });
  await page.route("**/client/employerBenchmarkReport?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "true",
        data: {
          tableHeaders: [
            {
              title: "All Size Categories",
              subTitle: "Winners",
              type: "All_Yes",
            },
            {
              title: "All Size Categories",
              subTitle: "Non-Winners",
              type: "All_No",
            },
          ],
          tableData: [
            {
              title: "Benefits",
              nestedData: [
                {
                  id: "question-1",
                  title: "Does your organization recognize milestones?",
                  type: "%",
                  nestedData: [
                    { title: "Yes", type: "%", dataValues: [88, 51] },
                    { title: "No", type: "%", dataValues: [12, 49] },
                  ],
                },
              ],
            },
          ],
        },
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Username").fill(clientFixtureUsername);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByLabel("Email").fill("client@example.invalid");
  await page.getByRole("button", { name: "Continue Log In" }).click();
  await page.goto("/benefits-and-best-practices");

  const stickyHeader = page
    .getByText("Metric Category")
    .locator("..")
    .locator("..");
  await expect(stickyHeader).toHaveCSS("position", "sticky");
  await expect(
    page.getByText("Winners", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Non-Winners", { exact: true }).first(),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Does your organization recognize milestones?",
    })
    .click();
  await expect(page.getByText("88%").first()).toBeVisible();
  await expect(page.getByText("51%").first()).toBeVisible();
});
