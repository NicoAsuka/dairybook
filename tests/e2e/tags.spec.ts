import { test, expect } from "@playwright/test";
import { mockGitHub } from "./_mocks";

test("create tag → assign to entry → see colored bar", async ({ page }) => {
  await mockGitHub(page);

  // Add tags.json route — registered after mockGitHub so it takes precedence
  // over the month-data route (Playwright LIFO order).
  let tagsData: any = { version: 1, tags: [] };
  await page.route(/contents\/tags\.json/, async (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          sha: "tagsha",
          encoding: "base64",
          content: Buffer.from(JSON.stringify(tagsData)).toString("base64"),
        }),
      });
    } else {
      const body = JSON.parse(route.request().postData()!);
      tagsData = JSON.parse(Buffer.from(body.content, "base64").toString());
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: "newtagsha" } }),
      });
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  // Open settings and create tag
  await page.getByRole("button", { name: "设置" }).click();
  await page.locator('input[placeholder*="id"]').fill("work");
  await page.locator('input[placeholder*="名字"]').fill("工作");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page.getByRole("button", { name: "关闭" }).click();

  // Wait for tags to save (debounce 1s + PUT + render)
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 10000 });

  // Create entry and select work tag
  await page.getByRole("button", { name: /新增条目/ }).click();
  await page.locator("textarea").fill("写代码");
  // In EntryEditor's TagSelect, click the "工作" tag button
  await page.locator('.tag-row button:has-text("工作")').click();
  await page.getByRole("button", { name: "保存", exact: true }).click();

  // Verify EntryCard .bar color = #5a8dee → rgb(90, 141, 238)
  await expect(page.locator(".timeline .bar").first()).toHaveCSS(
    "background-color",
    "rgb(90, 141, 238)",
  );
});
