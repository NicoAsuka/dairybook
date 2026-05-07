import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("export markdown downloads a .md file with entries", async ({ page }) => {
  const may = {
    version: 1, month: "2026-05",
    days: {
      "2026-05-07": { entries: [
        { id: "a", start: "09:00", end: "10:00", text: "测试导出",
          tagId: null, createdAt: "2026-05-07T09:00:00Z", updatedAt: "2026-05-07T09:00:00Z" },
      ]},
    },
  };
  await mockGitHub(page, { monthData: may });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/dairybook-\d{4}-\d{2}-\d{2}\.md/);
  const path = await download.path();
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(path!, "utf8");
  expect(content).toContain("# 2026-05");
  expect(content).toContain("测试导出");
});
