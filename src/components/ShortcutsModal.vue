<script setup lang="ts">
import Icon from "./Icon.vue";

defineEmits<{ close: [] }>();

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const groups: { name: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    name: "导航",
    items: [
      { keys: ["←"], desc: "前一天" },
      { keys: ["→"], desc: "后一天" },
      { keys: ["T"], desc: "跳到今天" },
      { keys: [mod, "B"], desc: "切换侧栏" },
    ],
  },
  {
    name: "操作",
    items: [
      { keys: ["N"], desc: "新建条目" },
      { keys: [mod, "K"], desc: "搜索" },
      { keys: [mod, "/"], desc: "搜索（同上）" },
      { keys: [mod, ","], desc: "设置" },
      { keys: [mod, "."], desc: "统计" },
      { keys: ["?"], desc: "显示这个面板" },
      { keys: ["Esc"], desc: "关闭弹窗 / 取消" },
    ],
  },
  {
    name: "编辑器内",
    items: [
      { keys: [mod, "Enter"], desc: "保存" },
      { keys: ["Esc"], desc: "取消" },
    ],
  },
];
</script>

<template>
  <div class="shortcuts" @click.stop>
    <header class="head">
      <div class="title">
        <Icon name="keyboard" :size="18" />
        <h2>键盘快捷键</h2>
      </div>
      <button class="icon-btn" @click="$emit('close')" aria-label="关闭">
        <Icon name="x" />
      </button>
    </header>

    <div class="grid">
      <section v-for="g in groups" :key="g.name">
        <h3>{{ g.name }}</h3>
        <ul>
          <li v-for="(s, i) in g.items" :key="i">
            <span class="desc">{{ s.desc }}</span>
            <span class="keys">
              <kbd v-for="k in s.keys" :key="k">{{ k }}</kbd>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shortcuts {
  padding: 18px 22px;
  width: min(560px, 100%);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.head .title { display: flex; align-items: center; gap: 8px; }
.head h2 { margin: 0; font-size: 17px; font-weight: 600; }
.icon-btn {
  width: 30px; height: 30px;
  padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.icon-btn:hover { color: var(--text); background: var(--bg); border-color: transparent; }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
section h3 {
  margin: 0 0 10px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  font-weight: 600;
}
section ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
section li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.desc { color: var(--text); }
.keys { display: inline-flex; gap: 3px; }
kbd {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  color: var(--text-muted);
  min-width: 18px;
  text-align: center;
}

@media (max-width: 600px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
