import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import "./lib/theme";   // 副作用：监听 prefers-color-scheme + watch themeMode

createApp(App).mount("#app");
