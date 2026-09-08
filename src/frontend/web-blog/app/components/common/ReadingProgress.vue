<!--
  @file ReadingProgress.vue
  @description 固定在视口顶部的阅读进度条
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="reading-progress" aria-hidden="true">
    <div class="reading-progress__bar" :style="{ transform: `scaleX(${clamped / 100})` }" />
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
  width: 100%;
  transform-origin: left;
  background: var(--accent);
  transition: transform 0.08s linear;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
