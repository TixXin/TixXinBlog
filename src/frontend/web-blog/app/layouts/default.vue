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

const contentTransition = computed(() => ({
  name: contentTransitionName.value,
  mode: 'out-in' as const,
  duration: contentTransitionDuration.value,
}))
</script>
