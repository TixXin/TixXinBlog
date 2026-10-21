<!--
  @file DefaultStatusFooter.vue
  @description 宿主默认状态页脚：主题未提供 StatusFooter 时使用，避免跨主题回退
  @author TixXin
  @since 2026-10-22
-->

<template>
  <SharedStatusFooter />
</template>

<script setup lang="ts">
import SharedStatusFooter from '~/components/layout/StatusFooter.vue'
</script>
