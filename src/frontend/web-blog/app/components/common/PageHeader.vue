<!--
  @file PageHeader.vue
  @description 通用页面标题组件，带图标、标题和副标题
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="page-header">
    <h2 class="page-header__title">
      <Icon :name="icon" size="18" class="page-header__icon" />
      {{ title }}
    </h2>
    <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  icon: string
}>()
</script>

<style lang="scss" scoped>
.page-header {
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
}

.page-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.page-header__icon {
  color: var(--text-soft);
}

.page-header__subtitle {
  font-size: 0.875rem;
  color: var(--text-soft);
  margin-top: 0.25rem;
}
</style>
