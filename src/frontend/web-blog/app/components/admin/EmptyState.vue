<!--
  @file EmptyState.vue
  @description 后台列表空状态：图标、标题、可选说明，以及“新建”“清除筛选”等后续操作（actions 插槽）
  @author TixXin
  @since 2026-11-06
-->

<template>
  <div class="admin-empty">
    <Icon :name="icon" size="28" class="admin-empty__icon" aria-hidden="true" />
    <p class="admin-empty__title">{{ title }}</p>
    <p v-if="description" class="admin-empty__description">{{ description }}</p>
    <div v-if="$slots.actions" class="admin-empty__actions admin-toolbar">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; icon?: string }>(), {
  icon: 'lucide:inbox',
  description: '',
})
</script>
