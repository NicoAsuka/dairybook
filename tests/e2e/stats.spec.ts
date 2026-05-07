import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("stats modal shows weekly bar chart with totals", async ({ page }) => {
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:30", text: "工作",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "统计" }).click();

  await expect(page.locator(".stats")).toBeVisible();
  await expect(page.locator(".stats svg")).toBeVisible();
  await expect(page.locator(".totals")).toContainText("1h30m");
});
