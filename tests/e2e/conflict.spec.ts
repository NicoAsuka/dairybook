import { test, expect } from "@playwright/test";

test("409 on save -> fetch remote -> merge -> re-PUT keeps both entries", async ({ page }) => {
  let putCount = 0;
  let currentSha = "sha-base";
  const remoteEntry = {
    id: "01REMOTE0000000000000000000",
    start: "11:00",
    end: "12:00",
    text: "来自另一台设备",
    tagId: null,
    createdAt: "2026-05-07T11:00:00Z",
    updatedAt: "2026-05-07T11:00:00Z",
  };

  await page.route("https://github.com/login/device/code", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({
      device_code: "DC", user_code: "TC", verification_uri: "https://x", expires_in: 900, interval: 1,
    })}));
  await page.route("https://github.com/login/oauth/access_token", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ access_token: "ghu_x", token_type: "bearer" })}));
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ login: "alice" })}));
  await page.route("https://api.github.com/repos/alice/dairybook-data", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ name: "dairybook-data" })}));

  await page.route(/contents\/data\/.+\.json/, async (route) => {
    if (route.request().method() === "GET") {
      const body = putCount >= 1
        ? { version: 1, month: "2026-05", days: { "2026-05-07": { entries: [remoteEntry] } } }
        : { version: 1, month: "2026-05", days: {} };
      currentSha = `sha-${putCount}`;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({
        sha: currentSha, encoding: "base64", content: Buffer.from(JSON.stringify(body)).toString("base64"),
      })});
    } else {
      putCount++;
      if (putCount === 1) {
        route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "sha mismatch" })});
      } else {
        const merged = JSON.parse(Buffer.from(JSON.parse(route.request().postData()!).content, "base64").toString());
        const entries = merged.days["2026-05-07"].entries;
        expect(entries.length).toBe(2);
        route.fulfill({ contentType: "application/json", body: JSON.stringify({ content: { sha: "sha-merged" } })});
      }
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".timeline")).toBeVisible();

  await page.getByRole("button", { name: /\+ 新增条目/ }).click();
  await page.locator("textarea").fill("本地新条目");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("已保存")).toBeVisible({ timeout: 6000 });
  await expect(page.getByText("本地新条目")).toBeVisible();
  await expect(page.getByText("来自另一台设备")).toBeVisible();
  expect(putCount).toBeGreaterThanOrEqual(2);
});
