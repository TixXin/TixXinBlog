<!--
  @file RootLayout.vue
  @description 单栏极简主题的根布局入口，桥接现有博客布局组件到主题引擎
  @author TixXin
  @since 2026-04-03
-->

<template>
  <MinimalLayout>
    <slot />
  </MinimalLayout>
</template>

<script setup lang="ts">
import MinimalLayout from '../../../../app/themes/minimal/MinimalLayout.vue'
</script>
