import { beforeEach, describe, expect, it } from "vitest";
import { clear } from "idb-keyval";
import { cacheMonth, getCachedMonth, getToken, setToken, clearToken } from "@/lib/idb";
import { makeMonth } from "../fixtures/month";

beforeEach(async () => {
  await clear();
  localStorage.removeItem("dairybook.token");
});

describe("month cache", () => {
  it("roundtrips a MonthDoc", async () => {
    const doc = { data: makeMonth("2026-05"), sha: "abc" };
    await cacheMonth("2026-05", doc);
    const got = await getCachedMonth("2026-05");
    expect(got?.sha).toBe("abc");
  });
  it("returns undefined for missing month", async () => {
    expect(await getCachedMonth("2026-05")).toBeUndefined();
  });
});

describe("token storage", () => {
  it("set / get / clear", () => {
    expect(getToken()).toBeNull();
    setToken("ghu_test");
    expect(getToken()).toBe("ghu_test");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
