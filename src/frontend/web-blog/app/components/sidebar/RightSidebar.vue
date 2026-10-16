<!--
  @file RightSidebar.vue
  @description 右侧栏容器组件，包裹右侧所有卡片子组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <!-- 首屏随 SSR 直出的侧栏标记 data-initial：已经显示在页面上，不再补播入场动画；切页后新建的实例才入场 -->
  <div class="right-sidebar-wrapper" :data-initial="initial || undefined">
    <slot />
  </div>
</template>

<script setup lang="ts">
const initial = import.meta.server || useNuxtApp().isHydrating
</script>

<style lang="scss" scoped>
.right-sidebar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
