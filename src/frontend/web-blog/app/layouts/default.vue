<!--
  @file default.vue
  @description 博客默认布局，稳定持有页面实例并将主题差异壳层委托给主题引擎渲染
  @author TixXin
  @since 2026-04-03
-->

<template>
  <ThemeComponent name="RootLayout">
    <NuxtPage :transition="contentTransition" />
  </ThemeComponent>
  <ThemeComponent name="ThemeAccessory" />
  <CommonAppearanceDrawer />
  <LayoutMobileNav />
</template>

<script setup lang="ts">
const { contentTransitionName, contentTransitionDuration } = useAppearanceSettings()

const route = useRoute()
const { enable: enableFullbleed, disable: disableFullbleed } = useFullbleedPage()

// 初始 / SSR：直接根据当前 route.meta 设置一次 fullbleed
if (route.meta.fullbleed) enableFullbleed()
else disableFullbleed()

const contentTransition = computed(() => ({
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
  /**
   * 关键：在新页面"进入前"才翻转 fullbleed 状态。
   * 配合 `mode: 'out-in'`，此时离场页面已完全卸载，不会再被布局变化挤压。
   */
  onBeforeEnter() {
    if (route.meta.fullbleed) enableFullbleed()
    else disableFullbleed()
  },
}))
</script>
