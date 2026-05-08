<script setup lang="ts">
import { useStore } from "@/lib/store";
import TagBadge from "./TagBadge.vue";

const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ "update:modelValue": [string | null] }>();

const store = useStore();

function pick(id: string | null) { emit("update:modelValue", id); }
</script>

<template>
  <div class="select">
    <button :class="{ active: modelValue === null }" @click="pick(null)">
      <TagBadge :tag="null" />
    </button>
    <button
      v-for="t in store.activeTags()"
      :key="t.id"
      :class="{ active: modelValue === t.id }"
      @click="pick(t.id)"
    >
      <TagBadge :tag="t" />
    </button>
    <span v-if="store.activeTags().length === 0" class="hint">
      还没有标签 · 去 ⚙️ 设置创建
    </span>
  </div>
</template>

<style scoped>
.select { display: flex; flex-wrap: wrap; gap: 4px; }
.select button {
  padding: 2px; background: transparent; border: 1px solid transparent;
  border-radius: 12px;
}
.select button.active { border-color: var(--accent); background: var(--bg); }
.hint { font-size: 11px; color: var(--text-faint); align-self: center; padding-left: 6px; }
</style>
