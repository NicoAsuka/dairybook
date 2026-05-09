<script setup lang="ts">
import { ref } from "vue";
import { startDeviceFlow, pollForToken } from "@/lib/auth";
import { useStore } from "@/lib/store";
import Icon from "./Icon.vue";

const store = useStore();
const userCode = ref<string | null>(null);
const verifyUrl = ref("");
const polling = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const CLIENT_ID = import.meta.env.VITE_GH_APP_CLIENT_ID as string;
const AUTH_PROXY = import.meta.env.VITE_AUTH_PROXY as string | undefined;

async function login() {
  error.value = null;
  try {
    const start = await startDeviceFlow(CLIENT_ID, AUTH_PROXY);
    userCode.value = start.userCode;
    verifyUrl.value = start.verificationUri;
    window.open(start.verificationUri, "_blank");
    polling.value = true;
    const token = await pollForToken(
      CLIENT_ID,
      start.deviceCode,
      {
        intervalSec: start.interval,
        maxTries: Math.ceil(start.expiresIn / start.interval),
      },
      AUTH_PROXY,
    );
    polling.value = false;
    if (!token) {
      error.value = "登录已取消或过期，请重试";
      return;
    }
    await store.setLoggedIn(token);
  } catch (e) {
    error.value = (e as Error).message;
    polling.value = false;
  }
}

async function copyCode() {
  if (!userCode.value) return;
  await navigator.clipboard.writeText(userCode.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1500);
}

function reset() {
  userCode.value = null;
  polling.value = false;
  error.value = null;
}
</script>

<template>
  <div class="login-page">
    <div class="login">
      <div class="brand">
        <Icon name="book" :size="28" />
        <h1>dairybook</h1>
      </div>
      <p class="subtitle">网页版日程手帐 · 数据在你自己的私有 GitHub 仓库</p>

      <div class="card">
        <template v-if="!userCode">
          <h2>用 GitHub 登录</h2>
          <p class="muted">
            dairybook 不在自己的服务器上保存任何数据，登录用于把日程写入你自己的私有仓库。
          </p>
          <button class="primary" @click="login">
            <Icon name="github" :size="16" />
            用 GitHub 账号继续
          </button>
        </template>

        <template v-else>
          <h2>验证设备</h2>
          <ol class="steps">
            <li>
              <span class="step-num">1</span>
              <div class="step-body">
                <p>复制下面的设备码</p>
                <div class="code-row">
                  <code class="code">{{ userCode }}</code>
                  <button class="copy" @click="copyCode">
                    <Icon :name="copied ? 'check' : 'edit'" :size="14" />
                    {{ copied ? "已复制" : "复制" }}
                  </button>
                </div>
              </div>
            </li>
            <li>
              <span class="step-num">2</span>
              <div class="step-body">
                <p>已为你打开 GitHub 授权页（如未弹出 <a :href="verifyUrl" target="_blank">点这里</a>），粘贴设备码并授权</p>
              </div>
            </li>
            <li>
              <span class="step-num">3</span>
              <div class="step-body">
                <p v-if="polling" class="polling">
                  <span class="dot" />
                  等待授权完成…
                </p>
                <p v-else class="muted">完成后这里会自动跳转</p>
                <button v-if="!polling" class="ghost" @click="reset">重试登录</button>
              </div>
            </li>
          </ol>
        </template>

        <div v-if="error" class="error">
          <Icon name="alert" :size="14" />
          {{ error }}
        </div>
      </div>

      <p class="footer">
        <a href="https://github.com/NicoAsuka/dairybook" target="_blank">查看源代码</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
  background: linear-gradient(180deg, var(--bg) 0%, var(--bg-subtle) 100%);
}
.login {
  width: min(460px, 100%);
}
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
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.subtitle {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 24px 0;
}

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 28px;
}
.card h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}
.card p {
  margin: 0 0 16px 0;
  font-size: 14px;
  line-height: 1.55;
}
.muted { color: var(--text-muted); }

.primary {
  width: 100%;
  padding: 11px;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.primary:hover {
  background: var(--accent-hover);
  color: #fff;
  border-color: var(--accent-hover);
}

.steps {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.steps li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.step-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}
.step-body {
  flex: 1;
  min-width: 0;
}
.step-body p { margin: 0 0 8px 0; font-size: 13px; }

.code-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.code {
  font-size: 22px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 8px 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--accent);
  flex: 1;
  text-align: center;
}
.copy {
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
  padding: 4px 10px;
}

.polling {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-weight: 500;
}
.polling .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--danger-soft);
  border-radius: 6px;
  color: var(--danger);
  font-size: 12px;
}

.footer {
  margin: 18px 0 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}
.footer a {
  color: var(--text-faint);
  text-decoration: underline;
}
.footer a:hover { color: var(--accent); }
</style>
