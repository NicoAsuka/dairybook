import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("first-time login flows through device code to main view", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("TEST-CODE")).toBeVisible();
  await expect(page.locator(".timeline")).toBeVisible({ timeout: 5000 });
});
