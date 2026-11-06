<!--
  @file FilterBar.vue
  @description 后台列表筛选栏：字段在左、提交与清除在右，提交时阻止默认导航；有生效筛选时显示“清除筛选”
  @author TixXin
  @since 2026-11-06
-->

<template>
  <form class="admin-filter-bar" role="search" :aria-label="label" @submit.prevent="$emit('submit')">
    <div class="admin-filter-bar__fields">
      <slot />
    </div>
    <div class="admin-filter-bar__actions">
      <slot name="actions" />
      <button v-if="active" type="button" class="admin-btn admin-btn--ghost" @click="$emit('reset')">
        <Icon name="lucide:x" aria-hidden="true" />{{ $t('admin-system.layout.clearFilters') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
defineProps<{ label: string; active?: boolean }>()
defineEmits<{ submit: []; reset: [] }>()
</script>
