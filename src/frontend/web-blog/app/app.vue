<!--
  @file app.vue
  @description Nuxt 应用根组件，挂载布局（NuxtPage 已移入 layouts/default.vue 以实现卡片持久化）
  @author TixXin
  @since 2025-03-17
-->

<template>
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
</script>
