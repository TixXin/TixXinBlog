<!--
  @file app.vue
  @description Nuxt 应用根组件，挂载布局（NuxtPage 已移入 layouts/default.vue 以实现卡片持久化）
  @author TixXin
  @since 2025-03-17
-->

<template>
  <CommonAppLoadingScreen :visible="isLoading" />
  <!-- 布局主题切换 loading：force-visible 绕过 html.visited 屏蔽，在切换期间全屏覆盖 -->
  <CommonAppLoadingScreen :visible="isThemeSwitchLoading" force-visible />
  <NuxtLayout />
  <ClientOnly>
    <CommonToastContainer />
    <CommonSearchModal v-model:visible="isSearchOpen" />
  </ClientOnly>
</template>

<script setup lang="ts">
const isSearchOpen = ref(false)
provide('searchModal', { open: () => (isSearchOpen.value = true) })
useKeyboardShortcuts()
useAnalytics()

// 首次访问 loading 动画状态 + 布局主题切换 loading 状态
const { isLoading, isThemeSwitchLoading, checkFirstVisit, dismiss } = useAppLoading()

// hydration 完成后关闭 loading：
// - 首次访问：至少展示 ~0.8s 避免闪烁
// - 非首次访问：立即关闭（视觉上早已被 CSS 隐藏，这里只更新状态避免 DOM 残留）
onNuxtReady(() => {
  if (checkFirstVisit()) {
    setTimeout(() => {
      dismiss()
    }, 800)
  } else {
    dismiss()
  }
})
</script>
