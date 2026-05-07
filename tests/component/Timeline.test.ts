import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Timeline from "@/components/Timeline.vue";
import { useStore, _resetStore } from "@/lib/store";
import { makeEntry } from "../fixtures/month";

function setup(entries = [makeEntry({ id: "a", start: "09:00", end: "10:30" })]) {
  _resetStore();
  const store = useStore();
  store.state.selectedDate = "2026-05-07";
  store.state.months["2026-05"] = {
    data: {
      version: 1,
      month: "2026-05",
      days: { "2026-05-07": { entries } },
    },
    sha: null,
  };
  return store;
}

describe("Timeline", () => {
  it("renders 24 hour rows", () => {
    setup([]);
    const w = mount(Timeline);
    expect(w.findAll(".hour-row")).toHaveLength(24);
  });

  it("places entry into hour grid spanning correct rows", () => {
    setup([makeEntry({ id: "a", start: "09:00", end: "10:30" })]);
    const w = mount(Timeline);
    const card = w.find('[data-entry-id="a"]');
    expect(card.attributes("style")).toMatch(/grid-row:\s*19\s*\/\s*22/);
  });

  it("places overlapping entries side by side", () => {
    setup([
      makeEntry({ id: "a", start: "09:00", end: "10:00" }),
      makeEntry({ id: "b", start: "09:30", end: "10:30" }),
    ]);
    const w = mount(Timeline);
    const a = w.find('[data-entry-id="a"]');
    const b = w.find('[data-entry-id="b"]');
    expect(a.attributes("style")).toMatch(/grid-column:\s*1/);
    expect(b.attributes("style")).toMatch(/grid-column:\s*2/);
  });
});
