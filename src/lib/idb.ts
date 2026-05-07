import { get, set } from "idb-keyval";
import type { MonthDoc } from "./types";

const KEY_TOKEN = "dairybook.token";
const monthKey = (m: string) => `month.${m}`;

export async function cacheMonth(month: string, doc: MonthDoc): Promise<void> {
  await set(monthKey(month), JSON.parse(JSON.stringify(doc)));
}

export async function getCachedMonth(month: string): Promise<MonthDoc | undefined> {
  return await get(monthKey(month));
}

export function setToken(token: string): void {
  localStorage.setItem(KEY_TOKEN, token);
}

export function getToken(): string | null {
  return localStorage.getItem(KEY_TOKEN);
}

export function clearToken(): void {
  localStorage.removeItem(KEY_TOKEN);
}
