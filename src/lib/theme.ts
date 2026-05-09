import { ref, watch } from "vue";

export type ThemeMode = "auto" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

const KEY = "dairybook.theme";

function readMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

export const themeMode = ref<ThemeMode>(readMode());

function systemDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function effective(): EffectiveTheme {
  if (themeMode.value === "auto") return systemDark() ? "dark" : "light";
  return themeMode.value;
}

export function applyTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", effective());
}

const ORDER: ThemeMode[] = ["auto", "light", "dark"];
export function cycleTheme() {
  const idx = ORDER.indexOf(themeMode.value);
  themeMode.value = ORDER[(idx + 1) % ORDER.length] ?? "auto";
}

watch(themeMode, (v) => {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, v);
  applyTheme();
});

if (typeof window !== "undefined" && window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (themeMode.value === "auto") applyTheme();
    });
}
