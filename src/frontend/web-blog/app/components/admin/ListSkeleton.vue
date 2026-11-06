<!--
  @file ListSkeleton.vue
  @description 后台列表加载占位：首次加载显示与列表同形的占位行或卡片，避免数据到达时页面跳动；
               已有内容时传 rows=0，只保留读屏可见的加载状态，不遮挡旧内容
  @author TixXin
  @since 2026-11-06
-->

<template>
  <div class="admin-skeleton" :class="`admin-skeleton--${variant}`" role="status" aria-live="polite">
    <span class="sr-only">{{ label }}</span>
    <span v-for="index in rows" :key="index" class="admin-skeleton__item" aria-hidden="true">
      <span class="admin-skeleton__line admin-skeleton__line--title" />
      <span class="admin-skeleton__line" />
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; rows?: number; variant?: 'rows' | 'cards' }>(), {
  rows: 4,
  variant: 'rows',
})
</script>
