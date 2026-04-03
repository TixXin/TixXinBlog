<!--
  @file RootLayout.vue
  @description 双栏文档主题的根布局入口，桥接现有博客布局组件到主题引擎
  @author TixXin
  @since 2026-04-03
-->

<template>
  <DocsLayout>
    <slot />
  </DocsLayout>
</template>

<script setup lang="ts">
import DocsLayout from '../../../../app/themes/docs/DocsLayout.vue'
</script>
