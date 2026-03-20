<!--
  @file ReadingProgress.vue
  @description 固定在视口顶部的阅读进度条
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="reading-progress" aria-hidden="true">
    <div class="reading-progress__bar" :style="{ width: `${clamped}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  progress: number
}>()

const clamped = computed(() => Math.min(100, Math.max(0, props.progress)))
</script>

<style lang="scss" scoped>
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 100;
  pointer-events: none;
  background: transparent;
}

.reading-progress__bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s ease-out;
}
</style>
