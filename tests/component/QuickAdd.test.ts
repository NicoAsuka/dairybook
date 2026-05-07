import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import QuickAdd from "@/components/QuickAdd.vue";

describe("QuickAdd", () => {
  it("emits 'add' with default 1h slot from clicked hour", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find("button").trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:00", end: "15:00" });
  });

  it("clamps end at 24:00 when hour=23", async () => {
    const w = mount(QuickAdd, { props: { hour: 23 } });
    await w.find("button").trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "23:00", end: "23:59" });
  });
});
