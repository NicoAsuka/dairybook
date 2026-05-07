import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("go offline → edit entry → reconnect → auto-sync succeeds", async ({ page }) => {
  await mockGitHub(page);

  // Add a route that aborts PUT when offline, falls through to mock otherwise
  let goOffline = false;
  await page.route(/contents\/data\/.+\.json/, async (route) => {
    if (goOffline && route.request().method() === "PUT") {
      route.abort("connectionrefused");
    } else {
      route.fallback();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  // Create an initial entry and wait for it to sync
  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("在线条目");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 5000 });

  // Go offline
  goOffline = true;

  // Create another entry while offline — save will fail
  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("离线条目");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  // Expect error status (save failed due to offline)
  await expect(page.getByText("保存失败")).toBeVisible({ timeout: 10000 });

  // Come back online
  goOffline = false;

  // Fire the "online" event so onReconnect listeners trigger retryFailed()
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // Wait for the sync to succeed
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 10000 });

  // Both entries should be visible
  await expect(page.getByText("在线条目")).toBeVisible();
  await expect(page.getByText("离线条目")).toBeVisible();
});
