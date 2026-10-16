<!--
  @file AppLoadingTopBar.vue
  @description 首屏加载顶部进度条（NProgress 风格细条），由 <html> 上的 CSS 变量驱动，水合前即可推进
  @author TixXin
  @since 2026-04-15
-->
<template>
  <div class="loading-topbar" aria-hidden="true">
    <div class="loading-topbar__bar" />
  </div>
</template>
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
  transition: opacity 300ms ease-out;
}
.loading-topbar__bar {
  height: 100%;
  width: 100%;
  background: var(--accent);
  transform-origin: left center;
  // 进度来自 useLoadingProgress 写入 <html> 的变量；SSR 首帧缺省为启动值
  transform: scaleX(var(--app-loading-progress, 0.08));
  transition: transform 200ms ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  // 仅在右端呈现光晕，营造"流动"感（全条模糊会拖累重绘）
  box-shadow:
    0 0 8px 0 var(--accent),
    0 0 4px 0 var(--accent);
}
// 内容就绪：拉满后淡出并退出渲染
html.app-client-ready .loading-topbar {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 300ms ease-out,
    visibility 0s linear 300ms;
}
// 非首次访问：<head> 内联脚本在 hydration 前给 <html> 加 .visited，CSS 立即生效，消除闪烁
html.visited .loading-topbar {
  display: none !important;
}
</style>
