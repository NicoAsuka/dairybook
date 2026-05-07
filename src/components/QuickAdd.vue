<script setup lang="ts">
const props = defineProps<{ hour: number }>();
const emit = defineEmits<{ add: [{ start: string; end: string }] }>();

function pad(n: number): string { return String(n).padStart(2, "0"); }

function handle() {
  const start = `${pad(props.hour)}:00`;
  const end = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  emit("add", { start, end });
}
</script>

<template>
  <button class="add-btn" @click.stop="handle" aria-label="Add">+</button>
</template>

<style scoped>
.add-btn {
  position: absolute; right: 6px; top: 6px;
  width: 22px; height: 22px; padding: 0; border-radius: 50%;
  border: 1px dashed var(--border-strong);
  background: transparent; color: var(--text-muted);
  opacity: 0; transition: opacity .15s;
}
.hour-cell:hover .add-btn { opacity: 1; }
.add-btn:hover { color: var(--accent); border-color: var(--accent); }
</style>
