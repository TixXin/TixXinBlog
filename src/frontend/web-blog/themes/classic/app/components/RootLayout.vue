<!--
  @file RootLayout.vue
  @description 经典三栏主题的根布局入口，桥接现有博客布局组件到主题引擎
  @author TixXin
  @since 2026-04-03
-->

<template>
  <ClassicLayout>
    <slot />
  </ClassicLayout>
</template>

<script setup lang="ts">
import ClassicLayout from '../../../../app/themes/classic/ClassicLayout.vue'
</script>
