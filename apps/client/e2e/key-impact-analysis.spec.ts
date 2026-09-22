import { expect, test } from "@playwright/test";

const contributions = {
  "How clearly do I understand our goals?": 18.4,
  "My work makes a difference": 17.2,
  "I can learn and grow here": 14.7,
  "My team supports me": 12.6,
  "Leaders communicate openly": 11.1,
  "Our benefits meet my needs": 9.2,
  "I am treated with respect": 7.4,
  "I have the tools I need": 5.3,
  "My workload is manageable": 2.5,
  "I know what is expected of me": 1.6,
};

test("shows a ranked table and unclipped secondary bubbles", async ({ page }) => {
  const session = {
    user: {
      id: "client-1",
      displayName: "Demo Client",
      email: "client@example.invalid",
      role: "client",
      permissions: [],
      programs: [{
        id: "demo-program-2026",
        name: "Demo Program",
        year: 2026,
        organizationName: "Demo Organization",
        entitlements: { KIA_Access: "yes" },
      }],
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    impersonation: null,
  };
  await page.addInitScript((storedSession) => {
    const storage = (globalThis as unknown as {
      localStorage: { setItem: (key: string, value: string) => void };
    }).localStorage;
    storage.setItem("wrg-client-access-token", "e2e-token");
    storage.setItem("wrg-client-session", JSON.stringify(storedSession));
  }, session);
  await page.route("**/user/report-statuses", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
  await page.route("**/reports/catalog?**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/client/getKeyImpactAnalysis?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "success",
        data: {
          mapping: contributions,
          report: Object.keys(contributions).map((key) => ({
            key,
            label: "Employee Experience",
            value: contributions[key as keyof typeof contributions] / 100,
          })),
          data: { signedUrl: null },
        },
      }),
    });
  });

  await page.goto("/key-impact-analysis");

  const table = page.getByRole("table", {
    name: "Key Impact Analysis contributions ranked from highest to lowest",
  });
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(10);
  await expect(table.locator("tbody tr").first()).toContainText("18.40%");
  const firstRow = table.locator("tbody tr").first();
  const rowBounds = await firstRow.boundingBox();
  const questionBounds = await firstRow.getByText("How clearly do I understand our goals?").boundingBox();
  const percentageBounds = await firstRow.getByText("18.40%").boundingBox();
  expect(rowBounds).not.toBeNull();
  expect(questionBounds).not.toBeNull();
  expect(percentageBounds).not.toBeNull();
  if (!rowBounds || !questionBounds || !percentageBounds) {
    throw new Error("The first ranked row must be visible");
  }
  expect(questionBounds.x + questionBounds.width).toBeLessThanOrEqual(
    rowBounds.x + rowBounds.width,
  );
  expect(percentageBounds.x + percentageBounds.width).toBeLessThanOrEqual(
    rowBounds.x + rowBounds.width,
  );
  await page.getByText("View contribution bubble chart").click();
  const chart = page.getByTestId("key-impact-chart");
  await expect(chart.getByRole("button")).toHaveCount(10);

  const chartBounds = await chart.boundingBox();
  expect(chartBounds).not.toBeNull();
  if (!chartBounds) throw new Error("The chart must be visible");
  for (const bubble of await chart.getByRole("button").all()) {
    const bounds = await bubble.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Every bubble must be visible");
    expect(bounds.x).toBeGreaterThanOrEqual(chartBounds.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      chartBounds.x + chartBounds.width,
    );
  }
  await chart.getByRole("button", {
    name: "I know what is expected of me, 1.60% of contribution",
  }).click();
  await expect(page.getByRole("dialog")).toContainText("1.60% of contribution");
  await page.getByRole("button", { name: "Close contribution details" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Report" }).click();
  expect((await download).suggestedFilename()).toBe("Key_Impact_Analysis_2026.png");
});
