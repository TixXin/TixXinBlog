<!--
  @file AppLoadingScreen.vue
  @description 首次访问全屏 loading 动画，展示品牌标识与进度暗示，退出时优雅淡出
  @author TixXin
  @since 2026-04-11
-->

<template>
  <Transition name="loading-screen">
    <div v-if="visible" class="loading-screen" :class="{ 'loading-screen--force': forceVisible }">
      <div class="loading-screen__content" aria-hidden="true">
        <!-- 品牌名：Tix 用主文字色，Xin 用强调色 -->
        <p class="loading-screen__brand">
          <span class="loading-screen__brand-tix">Tix</span><span class="loading-screen__brand-xin">Xin</span>
        </p>

        <!-- 副标题 -->
        <p class="loading-screen__tagline">Blog</p>

        <!-- 进度暗示条：真实进度由顶部 AppLoadingTopBar 呈现，此处仅作品牌动态 -->
        <div class="loading-screen__progress">
          <div class="loading-screen__progress-bar" />
        </div>
      </div>
      <p v-if="!forceVisible" class="loading-screen__recovery" role="alert">
        {{ $t('layout.loadingScreen.notStarted') }}
        <a :href="route.fullPath">{{ $t('layout.themeError.reload') }}</a>
      </p>
      <p v-else class="loading-screen__theme-status" role="status">{{ $t('layout.loadingScreen.loadingLayout') }}</p>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  // 强制显示：绕过 html.visited CSS 屏蔽，用于主题切换等首屏之外的场景
  forceVisible?: boolean
}>()

// 首屏品牌层不阻断：SSR 正文已在下方，品牌层由纯 CSS 定时淡出，
// 内容就绪（app:suspense:resolve）时再由 visible=false 触发退场并移出 DOM
const route = useRoute()
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
  // 非阻断：品牌层短暂呈现后自动淡出并放行指针事件，不等待水合；就绪更早时由 Transition 退场接管
  &:not(.loading-screen--force) {
    animation: loading-splash 0.9s ease forwards;
    @media (prefers-reduced-motion: reduce) {
      animation-timing-function: step-end;
    }
  }
}

.loading-screen__recovery {
  display: none;
  padding: 0.75rem 1rem;
  background: var(--surface-1);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  font-size: 0.875rem;
  a {
    margin-left: 0.5rem;
    text-decoration: underline;
    color: var(--accent-text);
  }
}

// 切换布局时保留当前内容和导航的可操作性，反馈只占用顶部小块空间。
.loading-screen.loading-screen--force {
  inset: 1rem auto auto 50%;
  transform: translateX(-50%);
  padding: 0.625rem 1rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-full;
  box-shadow: var(--shadow-card);
  pointer-events: none;
  .loading-screen__content {
    display: none;
  }
}
.loading-screen__theme-status {
  font-size: 0.8125rem;
  color: var(--text-main);
  white-space: nowrap;
}

html.app-startup-stalled .loading-screen:not(.loading-screen--force) {
  display: block !important;
  animation: none;
  opacity: 1;
  visibility: visible;
  inset: 0 0 auto;
  padding: 0.5rem;
  background: transparent;
  pointer-events: none;
  .loading-screen__content {
    display: none;
  }
  .loading-screen__recovery {
    display: block;
    width: fit-content;
    margin: auto;
    pointer-events: auto;
  }
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
  animation: loading-content-enter 0.3s cubic-bezier(0.22, 0.68, 0.35, 1) both;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

/* 品牌名 */
.loading-screen__brand {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
  // 继承全局字体；组件内直接声明 Inter 会让 @nuxt/fonts 向本组件样式重复注入全部 @font-face
  font-family: inherit;

  @media (min-width: $breakpoint-sm) {
    font-size: 3.5rem;
  }
}

.loading-screen__brand-tix {
  color: var(--text-main);
}

.loading-screen__brand-xin {
  color: var(--accent-text);
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
  background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%);
  border-radius: 1px;
  animation: loading-progress 1.2s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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

@keyframes loading-splash {
  0%,
  65% {
    opacity: 1;
    visibility: visible;
  }
  100% {
    opacity: 0;
    visibility: hidden;
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
// 复合选择器压过 .loading-screen:not(--force) 的关键帧声明：退场时取消自动淡出动画，由过渡从当前状态继续，
// 否则 Vue 会等待 0.9s 的 animation 结束才移出 DOM
.loading-screen.loading-screen-leave-active {
  pointer-events: none;
  animation: none;
  transition:
    opacity 0.25s cubic-bezier(0.22, 0.68, 0.35, 1),
    transform 0.25s cubic-bezier(0.22, 0.68, 0.35, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
