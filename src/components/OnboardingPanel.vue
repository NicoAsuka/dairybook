<script setup lang="ts">
import { useStore } from "@/lib/store";
import { ref } from "vue";
import Icon from "./Icon.vue";

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
  <div class="onboard-page">
    <div class="onboard">
      <div class="brand">
        <Icon name="book" :size="24" />
        <h1>还差最后一步</h1>
      </div>
      <p class="subtitle">
        dairybook 需要一个属于你自己的私有仓库 <code>dairybook-data</code> 来存日程
      </p>

      <div class="card">
        <ol class="steps">
          <li>
            <span class="num">1</span>
            <div class="body">
              <h3>创建数据仓库</h3>
              <p>从模板创建一个名为 <code>dairybook-data</code> 的仓库（保持私有）</p>
              <a :href="TEMPLATE_URL" target="_blank" class="step-action">
                打开模板页
                <span class="arrow">→</span>
              </a>
            </div>
          </li>
          <li>
            <span class="num">2</span>
            <div class="body">
              <h3>授权 dairybook App</h3>
              <p>把 dairybook GitHub App 安装到刚创建的 <code>dairybook-data</code> 仓库上</p>
              <a :href="APP_INSTALL_URL" target="_blank" class="step-action">
                安装 App
                <span class="arrow">→</span>
              </a>
            </div>
          </li>
          <li>
            <span class="num">3</span>
            <div class="body">
              <h3>回到这里</h3>
              <p>点下面的按钮检测，就可以开始使用了</p>
              <button class="primary" @click="recheck" :disabled="checking">
                <span v-if="checking" class="dot" />
                {{ checking ? "检查中…" : "检查就绪" }}
              </button>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboard-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
  background: linear-gradient(180deg, var(--bg) 0%, var(--bg-subtle) 100%);
}
.onboard { width: min(560px, 100%); }

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
  color: var(--text);
}
.brand h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.subtitle {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 24px 0;
}
.subtitle code,
.body code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.9em;
  padding: 1px 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 3px;
}

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 28px;
}

.steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.steps li {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.body {
  flex: 1;
  min-width: 0;
}
.body h3 {
  margin: 2px 0 4px 0;
  font-size: 14px;
  font-weight: 600;
}
.body p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.step-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.step-action:hover { text-decoration: underline; }
.arrow {
  transition: transform var(--transition);
}
.step-action:hover .arrow { transform: translateX(2px); }

.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  padding: 7px 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.primary:hover {
  background: var(--accent-hover);
  color: #fff;
  border-color: var(--accent-hover);
}
.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.primary .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
</style>
