<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted } from "vue";
import { useStore } from "@/lib/store";
import { searchEntries, type SearchFilter } from "@/lib/search";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import TagBadge from "./TagBadge.vue";
import Icon from "./Icon.vue";
import { renderMarkdown } from "@/lib/markdown";

const emit = defineEmits<{ close: []; jump: [string] }>();
const store = useStore();

const keyword = ref("");
const selectedTagIds = ref<(string | null)[]>([]);
const today = formatYMD(new Date());
const from = ref(formatYMD(addDays(parseYMD(today), -30)));
const to = ref(today);
const loading = ref(false);

const inputEl = useTemplateRef<HTMLInputElement>("inputEl");
onMounted(() => inputEl.value?.focus());

watch([from, to], async ([f, t]) => {
  loading.value = true;
  try { await store.prefetchMonths(f, t); }
  finally { loading.value = false; }
}, { immediate: true });

const filter = computed<SearchFilter>(() => {
  const f: SearchFilter = { from: from.value, to: to.value };
  if (keyword.value) f.keyword = keyword.value;
  if (selectedTagIds.value.length) f.tagIds = selectedTagIds.value;
  return f;
});

const monthsArray = computed(() => Object.values(store.state.months));
const hits = computed(() => searchEntries(monthsArray.value, filter.value));

const hasFilter = computed(
  () => Boolean(keyword.value || selectedTagIds.value.length),
);

function toggleTag(id: string | null) {
  const i = selectedTagIds.value.indexOf(id);
  if (i >= 0) selectedTagIds.value.splice(i, 1);
  else selectedTagIds.value.push(id);
}

function quickRange(days: number) {
  to.value = today;
  from.value = formatYMD(addDays(parseYMD(today), -days));
}

function jumpTo(date: string) {
  emit("jump", date);
  emit("close");
}

function formatDateLabel(d: string): string {
  const date = parseYMD(d);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
</script>

<template>
  <aside class="drawer" @click.self="$emit('close')">
    <div class="panel" role="dialog" aria-label="搜索">
      <header class="panel-head">
        <div class="title">
          <Icon name="search" :size="18" />
          <h2>搜索</h2>
        </div>
        <button class="icon-btn" @click="$emit('close')" aria-label="关闭">
          <Icon name="x" />
        </button>
      </header>

      <div class="search-input">
        <Icon name="search" :size="16" class="search-icon" />
        <input
          ref="inputEl"
          v-model="keyword"
          placeholder="搜索 entry 文本…"
        />
        <button v-if="keyword" class="clear-btn" @click="keyword = ''" aria-label="清空">
          <Icon name="x" :size="14" />
        </button>
      </div>

      <section class="filters">
        <div class="filter-block">
          <span class="label">日期范围</span>
          <div class="range-row">
            <input type="date" v-model="from" />
            <span class="dash">—</span>
            <input type="date" v-model="to" />
          </div>
          <div class="quick-ranges">
            <button @click="quickRange(7)">近 7 天</button>
            <button @click="quickRange(30)">近 30 天</button>
            <button @click="quickRange(90)">近 90 天</button>
          </div>
          <span v-if="loading" class="loading">加载中…</span>
        </div>

        <div class="filter-block">
          <span class="label">标签</span>
          <div class="tag-row">
            <button
              class="tag-pick"
              :class="{ on: selectedTagIds.includes(null) }"
              @click="toggleTag(null)"
            >
              <TagBadge :tag="null" />
            </button>
            <button
              v-for="t in store.activeTags()" :key="t.id"
              class="tag-pick"
              :class="{ on: selectedTagIds.includes(t.id) }"
              @click="toggleTag(t.id)"
            >
              <TagBadge :tag="t" />
            </button>
          </div>
        </div>
      </section>

      <div class="result-head">
        <span class="count">{{ hits.length }} 条结果</span>
        <span v-if="hasFilter" class="hint">
          <Icon name="check" :size="12" /> 已应用筛选
        </span>
      </div>

      <div class="results" v-if="hits.length">
        <button v-for="h in hits" :key="h.entry.id" class="hit" @click="jumpTo(h.date)">
          <div class="hit-meta">
            <span class="hit-date">{{ formatDateLabel(h.date) }}</span>
            <span class="hit-time">{{ h.entry.start }}–{{ h.entry.end }}</span>
            <TagBadge :tag="store.getTagById(h.entry.tagId)" />
          </div>
          <div
            class="hit-text"
            v-if="h.entry.text"
            v-html="renderMarkdown(h.entry.text)"
          />
          <div v-else class="hit-text empty">（空 entry）</div>
        </button>
      </div>

      <div v-else class="empty-state">
        <Icon name="search" :size="36" />
        <p class="empty-title">{{ hasFilter ? "无匹配结果" : "输入关键字或选标签开始搜索" }}</p>
        <p class="empty-hint">
          {{ hasFilter ? "试试放宽日期范围或换个关键字" : "也可按标签快速过滤当月之前的所有 entry" }}
        </p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex; justify-content: flex-end;
  z-index: 90;
  animation: fade 0.15s ease;
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

.panel {
  width: min(620px, 100%);
  background: var(--bg-elevated);
  padding: 18px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.06);
  animation: slideIn 0.2s ease;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -2px 0 0 0;
}
.panel-head .title {
  display: flex; align-items: center; gap: 8px;
  color: var(--text);
}
.panel-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
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

.search-input {
  position: relative;
  display: flex;
  align-items: center;
}
.search-input input {
  width: 100%;
  padding: 9px 36px 9px 36px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 14px;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-faint);
  pointer-events: none;
}
.clear-btn {
  position: absolute;
  right: 8px;
  width: 22px; height: 22px;
  padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 50%;
}
.clear-btn:hover { background: var(--bg); color: var(--text); }

.filters {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.filter-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  font-weight: 600;
}
.range-row {
  display: flex; align-items: center; gap: 8px;
}
.range-row input[type=date] {
  padding: 6px 10px;
  font-variant-numeric: tabular-nums;
}
.dash { color: var(--text-faint); }
.quick-ranges {
  display: flex;
  gap: 6px;
}
.quick-ranges button {
  padding: 3px 10px;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  background: var(--bg-elevated);
}
.quick-ranges button:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.loading {
  font-size: 11px;
  color: var(--text-faint);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-pick {
  background: transparent;
  border: 1.5px solid transparent;
  padding: 2px;
  border-radius: 999px;
}
.tag-pick.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 2px;
}
.result-head .hint {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--accent);
}

.results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
}
.hit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  text-align: left;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}
.hit:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}
.hit-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.hit-date {
  font-weight: 500;
  color: var(--text);
}
.hit-time {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.hit-text {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.hit-text :deep(p) { margin: 0; }
.hit-text :deep(strong) { font-weight: 600; }
.hit-text :deep(a) { color: var(--accent); }
.hit-text.empty { color: var(--text-faint); font-style: italic; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
  color: var(--text-faint);
}
.empty-state :deep(svg) { color: var(--border-strong); }
.empty-title { margin: 0; font-size: 14px; color: var(--text-muted); }
.empty-hint { margin: 0; font-size: 12px; color: var(--text-faint); }
</style>
