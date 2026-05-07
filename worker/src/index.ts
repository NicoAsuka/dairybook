const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

const GITHUB = "https://github.com";

const ROUTES: Record<string, string> = {
  "/device/code": `${GITHUB}/login/device/code`,
  "/access_token": `${GITHUB}/login/oauth/access_token`,
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const target = ROUTES[url.pathname];

    if (!target || request.method !== "POST") {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    }

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") ?? "application/json",
        Accept: request.headers.get("Accept") ?? "application/json",
      },
      body: request.body,
    });

    const headers = new Headers(CORS_HEADERS);
    headers.set("Content-Type", "application/json");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
