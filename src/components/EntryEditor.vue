<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Entry } from "@/lib/types";
import { isValidTime, compareTimes } from "@/lib/date";

const props = defineProps<{ entry: Entry }>();
const emit = defineEmits<{
  save: [Entry];
  delete: [];
  cancel: [];
}>();

const start = ref(props.entry.start);
const end = ref(props.entry.end);
const text = ref(props.entry.text);

watch(() => props.entry, (e) => { start.value = e.start; end.value = e.end; text.value = e.text; });

const valid = computed(() =>
  isValidTime(start.value) && isValidTime(end.value) && compareTimes(start.value, end.value) <= 0,
);

function save() {
  if (!valid.value) return;
  emit("save", {
    ...props.entry,
    start: start.value,
    end: end.value,
    text: text.value,
    updatedAt: new Date().toISOString(),
  });
}
</script>

<template>
  <div class="editor">
    <div class="row">
      <input v-model="start" placeholder="HH:MM" />
      <span>-</span>
      <input v-model="end" placeholder="HH:MM" />
    </div>
    <textarea v-model="text" rows="6" placeholder="What did you do 09-10..." />
    <div class="actions">
      <button data-action="delete" class="danger" @click="$emit('delete')">Delete</button>
      <span class="spacer" />
      <button data-action="cancel" @click="$emit('cancel')">Cancel</button>
      <button data-action="save" class="primary" :disabled="!valid" @click="save">Save</button>
    </div>
  </div>
</template>

<style scoped>
.editor { padding: 16px; min-width: 320px; }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.row input { width: 80px; }
textarea { width: 100%; resize: vertical; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.spacer { flex: 1; }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.primary:disabled { opacity: .4; cursor: not-allowed; }
.danger { color: #c0392b; }
</style>
