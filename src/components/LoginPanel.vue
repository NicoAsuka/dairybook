<script setup lang="ts">
import { ref } from "vue";
import { startDeviceFlow, pollForToken } from "@/lib/auth";
import { useStore } from "@/lib/store";

const store = useStore();
const userCode = ref<string | null>(null);
const verifyUrl = ref("");
const polling = ref(false);
const error = ref<string | null>(null);

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
    const token = await pollForToken(CLIENT_ID, start.deviceCode, {
      intervalSec: start.interval,
      maxTries: Math.ceil(start.expiresIn / start.interval),
    }, AUTH_PROXY);
    polling.value = false;
    if (!token) { error.value = "登录已取消或过期，请重试"; return; }
    await store.setLoggedIn(token);
  } catch (e) {
    error.value = (e as Error).message;
    polling.value = false;
  }
}

function copyCode() {
  if (userCode.value) navigator.clipboard.writeText(userCode.value);
}
</script>

<template>
  <div class="login">
    <h2>用 GitHub 登录</h2>
    <p>dairybook 不在自己的服务器上保存任何数据，登录用于把日程写入你自己的私有仓库。</p>
    <button v-if="!userCode" @click="login" class="primary">登录</button>

    <div v-else class="device">
      <p>1. 复制下面的码：</p>
      <div class="code">
        <code>{{ userCode }}</code>
        <button @click="copyCode">复制</button>
      </div>
      <p>2. 已为你打开 <a :href="verifyUrl" target="_blank">{{ verifyUrl }}</a>，粘贴后授权</p>
      <p v-if="polling" class="muted">等待你完成授权… 完成后这里会自动跳转。</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.login { max-width: 480px; margin: 80px auto; padding: 24px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); }
.code { display: flex; gap: 8px; align-items: center; }
.code code { font-size: 20px; font-family: ui-monospace, monospace; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border-strong); border-radius: 4px; }
.muted { color: var(--text-muted); font-size: 13px; }
.error { color: #c0392b; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
