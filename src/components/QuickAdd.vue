<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ hour: number }>();
const emit = defineEmits<{ add: [{ start: string; end: string }] }>();

const showCustom = ref(false);
const customStart = ref("");
const customEnd = ref("");

function pad(n: number): string { return String(n).padStart(2, "0"); }

function quickAdd() {
  const start = `${pad(props.hour)}:00`;
  const end = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  emit("add", { start, end });
}

function openCustom() {
  customStart.value = `${pad(props.hour)}:00`;
  customEnd.value = props.hour === 23 ? "23:59" : `${pad(props.hour + 1)}:00`;
  showCustom.value = true;
}

function confirm() {
  emit("add", { start: customStart.value, end: customEnd.value });
  showCustom.value = false;
}
</script>

<template>
  <div class="qa">
    <button data-action="quick" class="add-btn" @click.stop="quickAdd" aria-label="快速添加 1 小时">+</button>
    <button data-action="custom" class="add-btn alt" @click.stop="openCustom" aria-label="自定义时段">⋯</button>

    <div v-if="showCustom" class="popover" @click.stop>
      <input type="time" v-model="customStart" />
      <span>–</span>
      <input type="time" v-model="customEnd" />
      <button data-action="confirm" @click="confirm">添加</button>
    </div>
  </div>
</template>

<style scoped>
.qa { position: absolute; right: 6px; top: 6px; display: flex; gap: 2px; }
.add-btn {
  width: 22px; height: 22px; padding: 0; border-radius: 50%;
  border: 1px dashed var(--border-strong); background: transparent; color: var(--text-muted);
  opacity: 0; transition: opacity .15s;
}
.hour-cell:hover .add-btn { opacity: 1; }
.add-btn:hover { color: var(--accent); border-color: var(--accent); }
.popover {
  position: absolute; top: 28px; right: 0; z-index: 10;
  display: flex; gap: 4px; align-items: center;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 6px; box-shadow: var(--shadow-sm);
}
</style>
