<script setup lang="ts">
import { ref } from "vue";
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";
import type { Tag } from "@/lib/types";
import { buildJsonExport, buildMarkdownExport, downloadBlob } from "@/lib/export";

defineEmits<{ close: [] }>();
const store = useStore();

const newId = ref("");
const newName = ref("");
const newColor = ref("#5a8dee");

function addTag() {
  const id = newId.value.trim().toLowerCase();
  if (!id || !/^[a-z0-9_-]+$/.test(id)) { alert("ID 只能含 a-z 0-9 _ -"); return; }
  if (store.state.tags.data.tags.some((t) => t.id === id && t.deletedAt === null)) {
    alert("ID 已存在"); return;
  }
  const now = new Date().toISOString();
  const t: Tag = {
    id, name: newName.value.trim() || id, color: newColor.value,
    updatedAt: now, deletedAt: null,
  };
  store.upsertTag(t);
  newId.value = ""; newName.value = "";
}

function rename(t: Tag, name: string) {
  store.upsertTag({ ...t, name, updatedAt: new Date().toISOString() });
}
function recolor(t: Tag, color: string) {
  store.upsertTag({ ...t, color, updatedAt: new Date().toISOString() });
}
function remove(t: Tag) {
  if (confirm(`删除标签 "${t.name}"？已使用此标签的 entry 会变成未分类。`)) {
    store.deleteTag(t.id);
  }
}
function logout() {
  if (confirm("退出登录？本设备将清除 token。")) store.logout();
}

async function exportJson() {
  await loadAll();
  const blob = buildJsonExport(Object.values(store.state.months), store.state.tags.data);
  downloadBlob(blob, `dairybook-${new Date().toISOString().slice(0,10)}.json`);
}

async function exportMd() {
  await loadAll();
  const md = buildMarkdownExport(Object.values(store.state.months), store.state.tags.data);
  downloadBlob(new Blob([md], { type: "text/markdown" }), `dairybook-${new Date().toISOString().slice(0,10)}.md`);
}

async function loadAll() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  await store.prefetchMonths(yearAgo, today);
}
</script>

<template>
  <div class="settings">
    <header>
      <h2>设置</h2>
      <button @click="$emit('close')">关闭</button>
    </header>

    <section>
      <h3>标签</h3>
      <table>
        <tbody>
          <tr v-for="t in store.activeTags()" :key="t.id">
            <td><input type="color" :value="t.color" @change="recolor(t, ($event.target as HTMLInputElement).value)" /></td>
            <td><code>{{ t.id }}</code></td>
            <td><input :value="t.name" @change="rename(t, ($event.target as HTMLInputElement).value)" /></td>
            <td><TagBadge :tag="t" /></td>
            <td><button class="danger" @click="remove(t)">删除</button></td>
          </tr>
        </tbody>
      </table>

      <div class="add-row">
        <input type="color" v-model="newColor" />
        <input v-model="newId" placeholder="id (work)" maxlength="20" />
        <input v-model="newName" placeholder="名字 (工作)" maxlength="30" />
        <button class="primary" @click="addTag">新建</button>
      </div>
    </section>

    <section>
      <h3>导出</h3>
      <p class="muted">导出最近 12 个月的所有 entry。下载到本地，用于备份。</p>
      <div class="row">
        <button @click="exportMd">导出 Markdown</button>
        <button @click="exportJson">导出 JSON</button>
      </div>
    </section>

    <section>
      <h3>账号</h3>
      <p v-if="store.state.auth.kind === 'logged-in'" class="muted">@{{ store.state.auth.user.login }}</p>
      <button class="danger" @click="logout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
.settings { padding: 16px; min-width: 480px; max-width: 640px; }
header { display: flex; align-items: center; justify-content: space-between; }
section { margin-top: 16px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 4px; vertical-align: middle; }
.add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.add-row input[type=color] { width: 32px; height: 32px; padding: 2px; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.danger { color: #c0392b; }
.muted { color: var(--text-muted); }
.row { display: flex; gap: 8px; align-items: center; }
</style>
