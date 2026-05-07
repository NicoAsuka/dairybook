import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { mswServer } from "../setup";
import { GitHubClient, GitHubError } from "@/lib/github";

const owner = "alice";
const repo = "dairybook-data";
const token = "gh_test_xxx";

describe("GitHubClient.getMonth", () => {
  it("returns parsed JSON + sha when 200", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({
          sha: "deadbeef",
          content: btoa(JSON.stringify({ version: 1, month: "2026-05", days: {} })),
          encoding: "base64",
        }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getMonth("2026-05");
    expect(doc.sha).toBe("deadbeef");
    expect(doc.data.month).toBe("2026-05");
  });

  it("returns null sha when 404", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    const doc = await client.getMonth("2026-05");
    expect(doc.sha).toBeNull();
    expect(doc.data.days).toEqual({});
  });

  it("throws GitHubError(401) when token invalid", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "Bad credentials" }, { status: 401 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    await expect(client.getMonth("2026-05")).rejects.toThrow(GitHubError);
  });
});

describe("GitHubClient.putMonth", () => {
  it("PUT with sha sends correct body", async () => {
    let received: unknown;
    mswServer.use(
      http.put(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ content: { sha: "newsha123" } });
      }),
    );
    const client = new GitHubClient({ token, owner, repo });
    const result = await client.putMonth("2026-05", { version: 1, month: "2026-05", days: {} }, "oldsha");
    expect(result.sha).toBe("newsha123");
    expect((received as any).sha).toBe("oldsha");
    expect(typeof (received as any).content).toBe("string");
  });

  it("throws GitHubError(409) on sha conflict", async () => {
    mswServer.use(
      http.put(`https://api.github.com/repos/${owner}/${repo}/contents/data/2026-05.json`, () =>
        HttpResponse.json({ message: "sha mismatch" }, { status: 409 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    await expect(
      client.putMonth("2026-05", { version: 1, month: "2026-05", days: {} }, "oldsha"),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("GitHubClient.checkRepo", () => {
  it("returns ready when 200", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}`, () =>
        HttpResponse.json({ name: repo, private: true }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    expect(await client.checkRepo()).toBe("ready");
  });
  it("returns missing when 404", async () => {
    mswServer.use(
      http.get(`https://api.github.com/repos/${owner}/${repo}`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );
    const client = new GitHubClient({ token, owner, repo });
    expect(await client.checkRepo()).toBe("missing");
  });
});
