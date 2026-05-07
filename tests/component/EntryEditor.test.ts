import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EntryEditor from "@/components/EntryEditor.vue";
import { makeEntry } from "../fixtures/month";

describe("EntryEditor", () => {
  it("disables save when end < start", async () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ start: "10:00", end: "09:00" }) },
    });
    const saveBtn = w.find('button[data-action="save"]');
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });

  it("emits 'save' with patched entry on save", async () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ id: "a", text: "old" }) },
    });
    await w.find("textarea").setValue("new text");
    await w.find('button[data-action="save"]').trigger("click");
    const e = w.emitted("save")?.[0]?.[0] as any;
    expect(e.id).toBe("a");
    expect(e.text).toBe("new text");
  });

  it("emits 'delete' on delete click", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a" }) } });
    await w.find('button[data-action="delete"]').trigger("click");
    expect(w.emitted("delete")).toBeTruthy();
  });
});
