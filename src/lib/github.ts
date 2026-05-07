import type { MonthData, MonthDoc } from "./types";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function base64ToUtf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export class GitHubClient {
  constructor(private cfg: GitHubConfig) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private monthPath(month: string): string {
    return `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/data/${month}.json`;
  }

  async getMonth(month: string): Promise<MonthDoc> {
    const res = await fetch(this.monthPath(month), { headers: this.headers() });
    if (res.status === 404) {
      return { data: { version: 1, month, days: {} }, sha: null };
    }
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    const body = (await res.json()) as { sha: string; content: string; encoding: string };
    const json = JSON.parse(base64ToUtf8(body.content.replace(/\n/g, "")));
    return { data: json as MonthData, sha: body.sha };
  }

  async putMonth(month: string, data: MonthData, sha: string | null): Promise<{ sha: string }> {
    const res = await fetch(this.monthPath(month), {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `data: update ${month}`,
        content: utf8ToBase64(JSON.stringify(data, null, 2)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    const body = (await res.json()) as { content: { sha: string } };
    return { sha: body.content.sha };
  }

  async checkRepo(): Promise<"ready" | "missing"> {
    const res = await fetch(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}`, {
      headers: this.headers(),
    });
    if (res.status === 200) return "ready";
    if (res.status === 404 || res.status === 403) return "missing";
    throw new GitHubError(res.status, await res.text());
  }

  async getViewer(): Promise<{ login: string }> {
    const res = await fetch(`${API}/user`, { headers: this.headers() });
    if (!res.ok) throw new GitHubError(res.status, await res.text());
    return (await res.json()) as { login: string };
  }
}
