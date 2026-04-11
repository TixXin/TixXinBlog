<!--
  @file AppLoadingScreen.vue
  @description 首次访问全屏 loading 动画，展示品牌标识与进度暗示，退出时优雅淡出
  @author TixXin
  @since 2026-04-11
-->

<template>
  <Transition name="loading-screen">
    <div v-if="visible" class="loading-screen" aria-hidden="true">
      <div class="loading-screen__content">
        <!-- 品牌名：Tix 用主文字色，Xin 用强调色 -->
        <h1 class="loading-screen__brand">
          <span class="loading-screen__brand-tix">Tix</span><span class="loading-screen__brand-xin">Xin</span>
        </h1>

        <!-- 副标题 -->
        <p class="loading-screen__tagline">Blog</p>

        <!-- 进度暗示条 -->
        <div class="loading-screen__progress">
          <div class="loading-screen__progress-bar" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()
</script>

<style lang="scss" scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  // 继承博客背景点阵图案，保持品牌一致
  background-image: radial-gradient(var(--bg-dot) 1px, transparent 1px);
  background-size: var(--bg-dot-size) var(--bg-dot-size);
  // 顶层不参与内容滚动
  overflow: hidden;
}

// 非首次访问（内联脚本在 hydration 前设置）：直接隐藏，消除闪烁
// 注意：scoped 下 html.visited .loading-screen 仍会被正确转换为带 data-v-xxx 后缀的选择器
html.visited .loading-screen {
  display: none !important;
}

.loading-screen__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  // 内容入场动画：从下方淡入
  animation: loading-content-enter 0.5s cubic-bezier(0.22, 0.68, 0.35, 1) both;
}

/* 品牌名 */
.loading-screen__brand {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
  font-family: $font-family-base;

  @media (min-width: $breakpoint-sm) {
    font-size: 3.5rem;
  }
}

.loading-screen__brand-tix {
  color: var(--text-main);
}

.loading-screen__brand-xin {
  color: var(--accent);
}

/* 副标题 */
.loading-screen__tagline {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin: 0.25rem 0 0;
}

/* 进度暗示条容器 */
.loading-screen__progress {
  position: relative;
  width: 140px;
  height: 2px;
  margin-top: 1.25rem;
  background: var(--border-soft);
  border-radius: 1px;
  overflow: hidden;
}

/* 进度光条：左右循环滑动 */
.loading-screen__progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--accent) 50%,
    transparent 100%
  );
  border-radius: 1px;
  animation: loading-progress 1.2s ease-in-out infinite;
}

@keyframes loading-progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(250%);
  }
  100% {
    transform: translateX(-100%);
  }
}

@keyframes loading-content-enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Vue Transition 退出动画：整体向上滑出 + 淡出 */
.loading-screen-leave-active {
  transition:
    opacity 0.5s cubic-bezier(0.22, 0.68, 0.35, 1),
    transform 0.5s cubic-bezier(0.22, 0.68, 0.35, 1);
}

.loading-screen-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}

/* 无障碍：减少动效时简化为纯淡出 */
@media (prefers-reduced-motion: reduce) {
  .loading-screen__content {
    animation: none;
  }
  .loading-screen__progress-bar {
    animation: none;
    width: 100%;
    background: var(--accent);
  }
  .loading-screen-leave-to {
    transform: none;
  }
}
</style>
