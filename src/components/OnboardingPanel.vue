<script setup lang="ts">
import { useStore } from "@/lib/store";
import { ref } from "vue";

const store = useStore();
const checking = ref(false);

const TEMPLATE_URL = import.meta.env.VITE_DATA_REPO_TEMPLATE as string;
const APP_INSTALL_URL = import.meta.env.VITE_GH_APP_INSTALL_URL as string;

async function recheck() {
  if (store.state.auth.kind !== "logged-in") return;
  checking.value = true;
  await store.setLoggedIn(store.state.auth.token);
  checking.value = false;
}
</script>

<template>
  <div class="onboard">
    <h2>还差最后一步</h2>
    <p>dairybook 需要一个属于你自己的私有仓库 <code>dairybook-data</code> 来存日程。</p>
    <ol>
      <li>
        从模板创建仓库（保持私有）：
        <a :href="TEMPLATE_URL" target="_blank">点这里 →</a>
      </li>
      <li>
        把 dairybook GitHub App 安装到这个新仓库上：
        <a :href="APP_INSTALL_URL" target="_blank">安装 App →</a>
      </li>
      <li>
        回到这里点
        <button @click="recheck" :disabled="checking">
          {{ checking ? "检查中…" : "检查就绪" }}
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.onboard { max-width: 560px; margin: 80px auto; padding: 24px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); }
ol { line-height: 2; }
code { background: var(--bg); padding: 1px 6px; border-radius: 3px; }
</style>
