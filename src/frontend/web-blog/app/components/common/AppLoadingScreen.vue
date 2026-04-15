<!--
  @file AppLoadingScreen.vue
  @description 首次访问全屏 loading 动画，展示品牌标识与进度暗示，退出时优雅淡出
  @author TixXin
  @since 2026-04-11
-->

<template>
  <Transition name="loading-screen">
    <div
      v-if="visible"
      class="loading-screen"
      :class="{ 'loading-screen--force': forceVisible }"
      aria-hidden="true"
    >
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

        <!-- 真实进度百分比：仅首屏 loading 场景显示，主题切换场景（forceVisible）不渲染 -->
        <p
          v-if="!forceVisible"
          class="loading-screen__percent"
          :aria-label="`加载中 ${displayPercent}%`"
        >
          {{ displayPercent }}%
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

defineProps<{
  visible: boolean
  // 强制显示：绕过 html.visited CSS 屏蔽，用于主题切换等首屏之外的场景
  forceVisible?: boolean
}>()

// 读取首屏加载进度（主题切换场景 DOM 不渲染百分比，composable 仍可安全读取共享 state）
const { progress } = useLoadingProgress()

// Hydration 一致性守卫：
// 00.theme-preload plugin 在 enforce:'pre' 阶段（hydration 前）会调用 set(10→60)，
// 导致客户端首次渲染时 progress 已非 0，与 SSR 输出的 "0%" 不一致触发 mismatch。
// 用 isMounted 把首次 CSR 渲染也强制为 0，onMounted 后才切到真实 progress
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

// 向下取整 + 夹紧，防止浮点抖动导致 42% → 43% → 42% 视觉闪烁
const displayPercent = computed(() =>
  isMounted.value ? Math.min(100, Math.max(0, Math.floor(progress.value))) : 0,
)
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

// 非首次访问（内联脚本在 hydration 前设置）：直接隐藏首屏 loading，消除闪烁
// 注意：scoped 下 html.visited .loading-screen 仍会被正确转换为带 data-v-xxx 后缀的选择器
// 带 --force 修饰的实例（主题切换 loading）不受此屏蔽，仍可正常显示
html.visited .loading-screen:not(.loading-screen--force) {
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

/* 真实进度百分比文字 */
.loading-screen__percent {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-soft);
  letter-spacing: 0.05em;
  // 等宽数字 + 最小宽度 + 居中，防止 0→10→100 宽度变化造成抖动
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
  min-width: 3ch;
  text-align: center;
  line-height: 1;
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
