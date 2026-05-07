<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "@/lib/store";
import { searchEntries, type SearchFilter } from "@/lib/search";
import { addDays, formatYMD, parseYMD } from "@/lib/date";
import TagBadge from "./TagBadge.vue";
import { renderMarkdown } from "@/lib/markdown";

const emit = defineEmits<{ close: []; jump: [string] }>();
const store = useStore();

const keyword = ref("");
const selectedTagIds = ref<(string | null)[]>([]);
const today = formatYMD(new Date());
const from = ref(formatYMD(addDays(parseYMD(today), -30)));
const to = ref(today);
const loading = ref(false);

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

function toggleTag(id: string | null) {
  const i = selectedTagIds.value.indexOf(id);
  if (i >= 0) selectedTagIds.value.splice(i, 1);
  else selectedTagIds.value.push(id);
}

function jumpTo(date: string) {
  emit("jump", date);
  emit("close");
}
</script>

<template>
  <aside class="drawer" @click.self="$emit('close')">
    <div class="panel">
      <header>
        <h2>搜索</h2>
        <button @click="$emit('close')">关闭</button>
      </header>

      <div class="row">
        <input v-model="keyword" placeholder="关键字…" autofocus />
      </div>

      <div class="row range">
        <input type="date" v-model="from" />
        <span>到</span>
        <input type="date" v-model="to" />
        <span v-if="loading" class="muted">加载月份…</span>
      </div>

      <div class="row tags">
        <button :class="{ on: selectedTagIds.includes(null) }" @click="toggleTag(null)">
          <TagBadge :tag="null" />
        </button>
        <button
          v-for="t in store.activeTags()" :key="t.id"
          :class="{ on: selectedTagIds.includes(t.id) }"
          @click="toggleTag(t.id)"
        >
          <TagBadge :tag="t" />
        </button>
      </div>

      <div class="results">
        <p v-if="!hits.length" class="muted">无匹配。</p>
        <button v-for="h in hits" :key="h.entry.id" class="hit" @click="jumpTo(h.date)">
          <span class="hit-date">{{ h.date }}</span>
          <span class="hit-time">{{ h.entry.start }}–{{ h.entry.end }}</span>
          <TagBadge :tag="store.getTagById(h.entry.tagId)" />
          <span class="hit-text" v-html="renderMarkdown(h.entry.text)" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.drawer { position: fixed; inset: 0; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; z-index: 90; }
.panel { width: min(560px, 100%); background: var(--bg-elevated); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
header { display: flex; align-items: center; justify-content: space-between; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row.range input[type=date] { padding: 4px 6px; }
.row.tags button { background: transparent; border: 1px solid transparent; padding: 2px; border-radius: 12px; }
.row.tags button.on { border-color: var(--accent); background: var(--bg); }
.results { display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto; }
.hit {
  display: grid; grid-template-columns: auto auto auto 1fr; gap: 8px; align-items: center;
  text-align: left; background: transparent; border: 1px solid var(--border);
  padding: 6px 8px; border-radius: 4px;
}
.hit:hover { border-color: var(--accent); background: var(--bg); }
.hit-date { color: var(--text-muted); font-variant-numeric: tabular-nums; font-size: 12px; }
.hit-time { color: var(--text-faint); font-size: 11px; font-variant-numeric: tabular-nums; }
.hit-text { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hit-text :deep(p) { margin: 0; display: inline; }
.muted { color: var(--text-muted); }
</style>
