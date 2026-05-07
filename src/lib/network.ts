import { ref, onMounted, onUnmounted } from "vue";

export function useOnlineStatus() {
  const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);
  const onUp = () => { online.value = true; };
  const onDown = () => { online.value = false; };
  onMounted(() => {
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
  });
  onUnmounted(() => {
    window.removeEventListener("online", onUp);
    window.removeEventListener("offline", onDown);
  });
  return online;
}

type Listener = () => void;
const onlineListeners: Listener[] = [];

export function onReconnect(fn: Listener): void {
  onlineListeners.push(fn);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    for (const fn of onlineListeners) fn();
  });
}
