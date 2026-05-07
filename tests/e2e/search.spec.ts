import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("search by keyword filters results and jumps to date", async ({ page }) => {
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:00", text: "晨读人间词话",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
        { id: "b", start: "10:00", end: "11:00", text: "写代码 dairybook",
          tagId: null, createdAt: "2026-05-07T10:00:00Z", updatedAt: "2026-05-07T10:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "搜索" }).click();
  await page.locator('.drawer input[placeholder*="关键字"]').fill("代码");

  await expect(page.locator(".hit")).toHaveCount(1);
  await expect(page.locator(".hit-text")).toContainText("代码");
});
