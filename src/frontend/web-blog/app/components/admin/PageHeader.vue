<!--
  @file PageHeader.vue
  @description 后台页头：左侧标题与说明，右侧页面主操作与次要入口（actions 插槽），窄屏时操作换行到标题下
  @author TixXin
  @since 2026-11-06
-->

<template>
  <header class="admin-page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="intro">{{ intro }}</p>
    </div>
    <div v-if="$slots.actions" class="admin-toolbar">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; intro?: string }>()
</script>
