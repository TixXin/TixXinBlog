<!--
  @file app.vue
  @description Nuxt 应用根组件，挂载布局（NuxtPage 已移入 layouts/default.vue 以实现卡片持久化）
  @author TixXin
  @since 2025-03-17
-->

<template>
  <!-- 浏览器顶部加载进度条：NProgress 风格，与中央百分比共享 useLoadingProgress -->
  <CommonAppLoadingTopBar />
  <CommonAppLoadingScreen :visible="isLoading" />
  <!-- 布局主题切换 loading：force-visible 绕过 html.visited 屏蔽，在切换期间全屏覆盖 -->
  <CommonAppLoadingScreen :visible="isThemeSwitchLoading" force-visible />
  <NuxtLayout />
  <ClientOnly>
    <CommonToastContainer />
    <CommonSearchModal v-model:visible="isSearchOpen" />
    <AuthModal />
    <!-- Dev 调试面板：仅 dev 模式渲染，prod 构建被 DevOnly 整段 tree-shake -->
    <DevOnly>
      <DevDebugPanel />
    </DevOnly>
  </ClientOnly>
</template>

<script setup lang="ts">
const isSearchOpen = ref(false)
provide('searchModal', { open: () => (isSearchOpen.value = true) })
useKeyboardShortcuts()
useAnalytics()

// 首次访问 loading 动画状态 + 布局主题切换 loading 状态
const { isLoading, isThemeSwitchLoading, checkFirstVisit, dismiss } = useAppLoading()
// 首屏加载进度：顶部进度条 + 中央百分比共享
const {
  start: startProgress,
  set: setProgress,
  finish: finishProgress,
  reset: resetProgress,
} = useLoadingProgress()

// 客户端挂载后立即启动假进度（早于 onNuxtReady，最大化可见时间）
// 非首次访问路径不启动，progress 保持 0，顶部条与中央百分比均不可见
onMounted(() => {
  if (checkFirstVisit()) {
    startProgress()
  } else {
    resetProgress()
  }
})

// hydration 完成后关闭 loading：
// - 首次访问：跳到 95%，延迟 ~0.8s 再到 100% 并淡出，避免闪烁
// - 非首次访问：立即关闭（视觉上早已被 CSS 隐藏，这里只更新状态避免 DOM 残留）
onNuxtReady(() => {
  if (checkFirstVisit()) {
    setProgress(95)
    setTimeout(() => {
      finishProgress()
      dismiss()
    }, 800)
  } else {
    resetProgress()
    dismiss()
  }
})
</script>
