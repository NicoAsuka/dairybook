import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { pollForToken, startDeviceFlow } from "@/lib/auth";
import { mswServer } from "../setup";

const CLIENT_ID = "Iv23liTEST";

describe("startDeviceFlow", () => {
  it("returns user_code + device_code from GitHub", async () => {
    mswServer.use(
      http.post("https://github.com/login/device/code", async ({ request }) => {
        const body = (await request.json()) as { client_id: string };
        expect(body.client_id).toBe(CLIENT_ID);
        return HttpResponse.json({
          device_code: "DC123",
          user_code: "AB12-CD34",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        });
      }),
    );
    const r = await startDeviceFlow(CLIENT_ID);
    expect(r.userCode).toBe("AB12-CD34");
    expect(r.interval).toBe(5);
  });
});

describe("pollForToken", () => {
  it("returns token when authorized", async () => {
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () =>
        HttpResponse.json({
          access_token: "ghu_xxx",
          token_type: "bearer",
        }),
      ),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", {
      intervalSec: 0.01,
      maxTries: 1,
    });
    expect(t).toBe("ghu_xxx");
  });

  it("returns null on access_denied", async () => {
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () =>
        HttpResponse.json({ error: "access_denied" }),
      ),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", {
      intervalSec: 0.01,
      maxTries: 1,
    });
    expect(t).toBeNull();
  });

  it("retries on authorization_pending", async () => {
    let calls = 0;
    mswServer.use(
      http.post("https://github.com/login/oauth/access_token", () => {
        calls++;
        if (calls === 1)
          return HttpResponse.json({ error: "authorization_pending" });
        return HttpResponse.json({
          access_token: "ghu_yyy",
          token_type: "bearer",
        });
      }),
    );
    const t = await pollForToken(CLIENT_ID, "DC123", {
      intervalSec: 0.01,
      maxTries: 5,
    });
    expect(t).toBe("ghu_yyy");
    expect(calls).toBe(2);
  });
});
