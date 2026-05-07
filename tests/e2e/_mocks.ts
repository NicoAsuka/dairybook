import type { Page } from "@playwright/test";

export async function mockGitHub(page: Page, opts: {
  monthData?: Record<string, unknown>;
  monthSha?: string;
  user?: string;
  token?: string;
} = {}) {
  const user = opts.user ?? "alice";
  const token = opts.token ?? "ghu_test_token";
  const monthSha = opts.monthSha ?? "sha-abc";

  await page.route("https://github.com/login/device/code", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        device_code: "DC-MOCK",
        user_code: "TEST-CODE",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 1,
      }),
    }),
  );

  await page.route("https://github.com/login/oauth/access_token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: token, token_type: "bearer" }),
    }),
  );

  await page.route("https://api.github.com/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: user }),
    }),
  );

  await page.route(`https://api.github.com/repos/${user}/dairybook-data`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "dairybook-data", private: true }),
    }),
  );

  let currentSha = monthSha;
  let currentData = opts.monthData ?? { version: 1, month: "2026-05", days: {} };

  await page.route(/api\.github\.com\/repos\/[^/]+\/dairybook-data\/contents\/data\/.+\.json/, async (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: currentSha,
          encoding: "base64",
          content: Buffer.from(JSON.stringify(currentData)).toString("base64"),
        }),
      });
    } else {
      const body = JSON.parse(route.request().postData() ?? "{}");
      currentData = JSON.parse(Buffer.from(body.content, "base64").toString());
      currentSha = `sha-${Date.now()}`;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: { sha: currentSha } }),
      });
    }
  });
}
