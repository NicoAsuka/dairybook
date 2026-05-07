export interface DeviceFlowStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
}

const SCOPE = "repo";

function endpoints(proxyBase?: string) {
  const base = proxyBase ?? "https://github.com";
  return {
    deviceCode: proxyBase
      ? `${base}/device/code`
      : `${base}/login/device/code`,
    accessToken: proxyBase
      ? `${base}/access_token`
      : `${base}/login/oauth/access_token`,
  };
}

export async function startDeviceFlow(
  clientId: string,
  proxyBase?: string,
): Promise<DeviceFlowStart> {
  const ep = endpoints(proxyBase);
  const res = await fetch(ep.deviceCode, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ client_id: clientId, scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`device flow start failed: ${res.status}`);
  const body = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  };
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    interval: body.interval,
    expiresIn: body.expires_in,
  };
}

export interface PollOpts {
  intervalSec: number;
  maxTries: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  opts: PollOpts,
  proxyBase?: string,
): Promise<string | null> {
  const ep = endpoints(proxyBase);
  let interval = opts.intervalSec;
  for (let i = 0; i < opts.maxTries; i++) {
    const res = await fetch(ep.accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    if (body.access_token) return body.access_token;
    if (body.error === "access_denied" || body.error === "expired_token")
      return null;
    if (body.error === "slow_down") interval += 5;
    await sleep(interval * 1000);
  }
  return null;
}
