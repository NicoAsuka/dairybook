import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("create entry -> debounce save -> reload sees it", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("测试 e2e 写入");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.getByText("测试 e2e 写入")).toBeVisible();
});
