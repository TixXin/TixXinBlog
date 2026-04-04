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
  </ClientOnly>
</template>

<script setup lang="ts">
useKeyboardShortcuts()
</script>
