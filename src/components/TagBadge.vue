<script setup lang="ts">
import type { Tag } from "@/lib/types";
defineProps<{ tag: Tag | null }>();
</script>

<template>
  <span v-if="tag" class="badge" :style="{ background: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }">
    {{ tag.name }}
  </span>
  <span v-else class="badge muted">未分类</span>
</template>

<style scoped>
.badge {
  display: inline-block; font-size: 11px;
  padding: 1px 8px; border-radius: 10px;
  border: 1px solid var(--border);
  line-height: 1.6;
}
.muted { color: var(--text-faint); background: var(--bg); }
</style>
