<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Entry } from "@/lib/types";
import { isValidTime, compareTimes } from "@/lib/date";
import { renderMarkdown } from "@/lib/markdown";
import TagSelect from "./TagSelect.vue";

const props = defineProps<{ entry: Entry }>();
const emit = defineEmits<{ save: [Entry]; delete: []; cancel: [] }>();

const start = ref(props.entry.start);
const end = ref(props.entry.end);
const text = ref(props.entry.text);
const tagId = ref<string | null>(props.entry.tagId);
const showPreview = ref(false);

watch(() => props.entry, (e) => {
  start.value = e.start; end.value = e.end; text.value = e.text; tagId.value = e.tagId;
});

const valid = computed(() =>
  isValidTime(start.value) && isValidTime(end.value) && compareTimes(start.value, end.value) <= 0,
);

const previewHtml = computed(() => renderMarkdown(text.value));

function save() {
  if (!valid.value) return;
  emit("save", {
    ...props.entry,
    start: start.value, end: end.value, text: text.value, tagId: tagId.value,
    updatedAt: new Date().toISOString(),
  });
}
</script>

<template>
  <div class="editor">
    <div class="row">
      <input v-model="start" placeholder="HH:MM" />
      <span>–</span>
      <input v-model="end" placeholder="HH:MM" />
    </div>

    <div class="tag-row">
      <span class="label">标签</span>
      <TagSelect v-model="tagId" />
    </div>

    <div class="text-area">
      <textarea v-model="text" rows="6" placeholder="支持 **markdown** 和 [链接](https://...)" />
      <button class="preview-toggle" type="button" @click="showPreview = !showPreview">
        {{ showPreview ? "✎ 编辑" : "👁 预览" }}
      </button>
      <div v-if="showPreview && text" class="preview" v-html="previewHtml" />
    </div>

    <div class="actions">
      <button data-action="delete" class="danger" @click="$emit('delete')">删除</button>
      <span class="spacer" />
      <button data-action="cancel" @click="$emit('cancel')">取消</button>
      <button data-action="save" class="primary" :disabled="!valid" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.editor { padding: 16px; min-width: 380px; max-width: 500px; }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.row input { width: 80px; }
.tag-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; }
.label { font-size: 12px; color: var(--text-muted); padding-top: 4px; min-width: 32px; }
.text-area { position: relative; margin-bottom: 12px; }
textarea { width: 100%; resize: vertical; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.preview-toggle { position: absolute; right: 6px; top: 6px; font-size: 11px; padding: 2px 8px; }
.preview {
  margin-top: 8px; padding: 8px 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
}
.preview :deep(p) { margin: 0 0 .4em 0; }
.preview :deep(a) { color: var(--accent); }
.actions { display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.primary:disabled { opacity: .4; cursor: not-allowed; }
.danger { color: #c0392b; }
</style>
