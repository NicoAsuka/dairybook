<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted, onUnmounted } from "vue";
import type { Entry } from "@/lib/types";
import { isValidTime, compareTimes } from "@/lib/date";
import { renderMarkdown } from "@/lib/markdown";
import TagSelect from "./TagSelect.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ entry: Entry }>();
const emit = defineEmits<{ save: [Entry]; delete: []; cancel: [] }>();

const start = ref(props.entry.start);
const end = ref(props.entry.end);
const text = ref(props.entry.text);
const tagId = ref<string | null>(props.entry.tagId);
const showPreview = ref(false);

const textareaEl = useTemplateRef<HTMLTextAreaElement>("textareaEl");
onMounted(() => {
  // 自动聚焦到 textarea，方便立即输入
  setTimeout(() => textareaEl.value?.focus(), 0);
});

watch(() => props.entry, (e) => {
  start.value = e.start;
  end.value = e.end;
  text.value = e.text;
  tagId.value = e.tagId;
});

const valid = computed(() =>
  isValidTime(start.value) &&
  isValidTime(end.value) &&
  compareTimes(start.value, end.value) <= 0,
);

const duration = computed(() => {
  if (!valid.value) return "";
  const [sh = 0, sm = 0] = start.value.split(":").map(Number);
  const [eh = 0, em = 0] = end.value.split(":").map(Number);
  const min = eh * 60 + em - (sh * 60 + sm);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  if (!m) return `${h}h`;
  return `${h}h ${m}min`;
});

const previewHtml = computed(() => renderMarkdown(text.value));

const isModifierKey = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

function save() {
  if (!valid.value) return;
  emit("save", {
    ...props.entry,
    start: start.value,
    end: end.value,
    text: text.value,
    tagId: tagId.value,
    updatedAt: new Date().toISOString(),
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("cancel");
    return;
  }
  if (e.key === "Enter" && isModifierKey(e)) {
    e.preventDefault();
    save();
    return;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="editor" @click.stop>
    <header class="editor-head">
      <h2>编辑条目</h2>
      <button class="icon-btn" @click="$emit('cancel')" aria-label="关闭">
        <Icon name="x" />
      </button>
    </header>

    <section class="time-row">
      <div class="time-input">
        <label>开始</label>
        <input v-model="start" placeholder="HH:MM" maxlength="5" />
      </div>
      <span class="time-arrow">→</span>
      <div class="time-input">
        <label>结束</label>
        <input v-model="end" placeholder="HH:MM" maxlength="5" />
      </div>
      <span class="duration" v-if="duration">{{ duration }}</span>
      <span v-else-if="!valid" class="duration error">起止时间无效</span>
    </section>

    <section class="tag-row">
      <span class="label">标签</span>
      <TagSelect v-model="tagId" />
    </section>

    <section class="text-area">
      <div class="text-head">
        <span class="label">内容</span>
        <button class="toggle" type="button" @click="showPreview = !showPreview">
          <Icon :name="showPreview ? 'edit' : 'eye'" :size="13" />
          {{ showPreview ? "编辑" : "预览" }}
        </button>
      </div>
      <textarea
        v-show="!showPreview"
        ref="textareaEl"
        v-model="text"
        rows="7"
        placeholder="支持 **markdown** · [链接](https://...) · 行内 `代码`"
      />
      <div v-if="showPreview" class="preview">
        <div v-if="text" v-html="previewHtml" />
        <p v-else class="empty">还没写内容</p>
      </div>
      <p class="hint">⌘/Ctrl + Enter 保存 · Esc 取消</p>
    </section>

    <footer class="actions">
      <button data-action="delete" class="danger" @click="$emit('delete')">
        <Icon name="trash" :size="14" />
        删除
      </button>
      <span class="spacer" />
      <button data-action="cancel" @click="$emit('cancel')">取消</button>
      <button data-action="save" class="primary" :disabled="!valid" @click="save">
        保存
      </button>
    </footer>
  </div>
</template>

<style scoped>
.editor {
  padding: 18px 22px;
  width: 100%;
  min-width: 420px;
  max-width: 540px;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.editor-head h2 {
  margin: 0;
  font-size: 16px;
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

.time-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.time-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.time-input label {
  font-size: 11px;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.time-input input {
  width: 96px;
  padding: 6px 10px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  letter-spacing: 0.04em;
}
.time-arrow {
  color: var(--text-faint);
  padding-bottom: 8px;
}
.duration {
  margin-left: auto;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.duration.error {
  background: rgba(192, 57, 43, 0.08);
  color: var(--danger);
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  font-weight: 600;
}

.tag-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.tag-row > .label {
  padding-top: 4px;
  flex-shrink: 0;
  width: 32px;
}

.text-area {
  margin-bottom: 16px;
}
.text-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.toggle {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-muted);
}
.toggle:hover { color: var(--accent); border-color: var(--accent); }

textarea {
  width: 100%;
  resize: vertical;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 13px;
  line-height: 1.55;
  min-height: 110px;
}
.preview {
  padding: 10px 14px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  min-height: 110px;
  font-size: 14px;
  line-height: 1.6;
}
.preview :deep(p) { margin: 0 0 0.4em 0; }
.preview :deep(p:last-child) { margin-bottom: 0; }
.preview :deep(a) { color: var(--accent); }
.preview :deep(strong) { font-weight: 600; }
.preview :deep(code) {
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.9em;
}
.preview .empty { color: var(--text-faint); font-style: italic; margin: 0; }
.hint {
  margin: 6px 0 0 0;
  font-size: 11px;
  color: var(--text-faint);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.spacer { flex: 1; }
.actions button {
  padding: 7px 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}
.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.primary:disabled:hover {
  background: var(--accent);
  color: #fff;
}
.danger {
  color: var(--danger);
  border-color: transparent;
}
.danger:hover {
  background: rgba(192, 57, 43, 0.08);
  border-color: transparent;
  color: var(--danger);
}
</style>
