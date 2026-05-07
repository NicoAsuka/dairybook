import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import QuickAdd from "@/components/QuickAdd.vue";

describe("QuickAdd", () => {
  it("emits 'add' with default 1h slot from clicked hour", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find('[data-action="quick"]').trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:00", end: "15:00" });
  });

  it("opens picker on 'custom' button and emits chosen times", async () => {
    const w = mount(QuickAdd, { props: { hour: 14 } });
    await w.find('[data-action="custom"]').trigger("click");
    const inputs = w.findAll('input[type="time"]');
    await inputs[0].setValue("14:15");
    await inputs[1].setValue("14:50");
    await w.find('[data-action="confirm"]').trigger("click");
    const arg = w.emitted("add")?.[0]?.[0] as any;
    expect(arg).toEqual({ start: "14:15", end: "14:50" });
  });
});
