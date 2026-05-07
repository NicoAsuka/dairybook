import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import EntryEditor from "@/components/EntryEditor.vue";
import { useStore, _resetStore } from "@/lib/store";
import { makeEntry, makeTag } from "../fixtures/month";

beforeEach(() => {
  _resetStore();
  const store = useStore();
  store.state.tags = {
    data: { version: 1, tags: [makeTag({ id: "work" }), makeTag({ id: "rest", name: "休息", color: "#4caf7a" })] },
    sha: null,
  };
});

describe("EntryEditor", () => {
  it("disables save when end < start", () => {
    const w = mount(EntryEditor, {
      props: { entry: makeEntry({ start: "10:00", end: "09:00" }) },
    });
    expect(w.find('button[data-action="save"]').attributes("disabled")).toBeDefined();
  });

  it("emits save with patched text + tagId", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a", text: "old", tagId: null }) } });
    await w.find("textarea").setValue("new");
    const tagButtons = w.findAll(".tag-row button");
    await tagButtons[1]!.trigger("click");
    await w.find('button[data-action="save"]').trigger("click");
    const e = w.emitted("save")?.[0]?.[0] as any;
    expect(e.text).toBe("new");
    expect(e.tagId).toBe("work");
  });

  it("emits delete on delete click", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ id: "a" }) } });
    await w.find('button[data-action="delete"]').trigger("click");
    expect(w.emitted("delete")).toBeTruthy();
  });

  it("toggles markdown preview", async () => {
    const w = mount(EntryEditor, { props: { entry: makeEntry({ text: "**bold**" }) } });
    expect(w.find(".preview").exists()).toBe(false);
    await w.find(".preview-toggle").trigger("click");
    expect(w.find(".preview").html()).toContain("<strong>bold</strong>");
  });
});
