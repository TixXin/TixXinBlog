<!--
  @file StateBlock.vue
  @description 通用状态提示组件，用于空态、404、500 等场景的居中图文提示
  @author TixXin
  @since 2026-03-23
-->

<template>
  <div class="state-block">
    <div class="state-block__icon-wrap">
      <Icon :name="icon" size="48" class="state-block__icon" />
    </div>
    <h2 class="state-block__title">{{ title }}</h2>
    <p v-if="description" class="state-block__desc">{{ description }}</p>
    <span v-if="statusCode" class="state-block__code">{{ statusCode }}</span>
    <button v-if="actionLabel" type="button" class="state-block__action" @click="$emit('action')">
      <Icon name="lucide:arrow-left" size="14" />
      {{ actionLabel }}
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
  statusCode?: number | string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<style lang="scss" scoped>
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 2rem;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.state-block__icon-wrap {
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-3);
  margin-bottom: 0.75rem;
}

.state-block__icon {
  color: var(--text-soft);
}

.state-block__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.state-block__desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
  max-width: 24rem;
  line-height: 1.6;
}

.state-block__code {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-faint);
  line-height: 1;
  margin-bottom: 0.25rem;
}

.state-block__action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  cursor: pointer;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--accent-soft);
    border-color: var(--border-hover);
  }
}
</style>
