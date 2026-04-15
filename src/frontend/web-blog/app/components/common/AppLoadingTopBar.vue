<!--
  @file AppLoadingTopBar.vue
  @description 首屏加载顶部进度条（NProgress 风格细条），读取 useLoadingProgress 共享状态
  @author TixXin
  @since 2026-04-15
-->

<template>
  <ClientOnly>
    <Transition name="loading-topbar">
      <div v-if="topBarVisible" class="loading-topbar" aria-hidden="true">
        <div class="loading-topbar__bar" :style="{ transform: `scaleX(${scaleX})` }" />
      </div>
    </Transition>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { progress, topBarVisible } = useLoadingProgress()

// 夹紧到 0-1 区间，避免 target 阶段边界微超过引起的视觉跳动
const scaleX = computed(() => Math.min(1, Math.max(0, progress.value / 100)))
</script>

<style lang="scss" scoped>
.loading-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 10000;
  pointer-events: none;
  // 背景全透明，只靠 __bar 的 scaleX 呈现进度
  background: transparent;
}

.loading-topbar__bar {
  height: 100%;
  width: 100%;
  background: var(--accent);
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 200ms ease-out;
  // 仅在右端呈现光晕，营造"流动"感（全条模糊会拖累重绘）
  box-shadow:
    0 0 8px 0 var(--accent),
    0 0 4px 0 var(--accent);
}

// 非首次访问：与 AppLoadingScreen 对称的兜底屏蔽
// <head> 内联脚本在 hydration 前给 <html> 加 .visited，CSS 立即生效，消除闪烁
html.visited .loading-topbar {
  display: none !important;
}

// Vue Transition 淡出
.loading-topbar-leave-active {
  transition: opacity 300ms ease-out;
}

.loading-topbar-leave-to {
  opacity: 0;
}

// 无障碍：减少动效时去掉过渡与光晕
@media (prefers-reduced-motion: reduce) {
  .loading-topbar__bar {
    transition: none;
    box-shadow: none;
  }
  .loading-topbar-leave-active {
    transition: none;
  }
}
</style>
