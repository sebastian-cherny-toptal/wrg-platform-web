import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

test("shows PDF-style motivator cells and downloads the report as PDF", async ({ page }) => {
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
  await expect(table.locator("tbody td")).toHaveCount(10);
  const firstCell = table.locator("tbody td").first();
  await expect(firstCell).toContainText("18.4%");
  await expect(firstCell).toContainText("How clearly do I understand our goals?");
  await expect(firstCell.locator("span.rounded-full")).toHaveText("18.4%");
  await expect(page.getByText("View contribution bubble chart")).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    const first = await firstCell.boundingBox();
    const second = await table.locator("tbody td").nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first && second) {
      expect(second.y).toBe(first.y);
      expect(second.x).toBeGreaterThan(first.x);
    }
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Report" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Key_Impact_Analysis_2026.pdf");
  const bytes = await readFile(await file.path());
  expect(bytes.toString("ascii", 0, 5)).toBe("%PDF-");
});
