<!--
  @file HobbyCard.vue
  @description 兴趣爱好卡片组件，使用 Lucide 图标展示爱好标签
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card hobby-card">
    <h3 class="hobby-card__title">
      <Icon name="lucide:heart" size="14" /> 兴趣爱好
    </h3>
    <div class="hobby-card__tags">
      <span v-for="h in hobbies" :key="h.label" class="hobby-card__tag">
        <Icon :name="h.icon" size="12" /> {{ h.label }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { HobbyItem } from '~/features/about/types'

defineProps<{
  hobbies: HobbyItem[]
}>()
</script>

<style lang="scss" scoped>
.hobby-card {
  padding: 1.25rem;
}

.hobby-card__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hobby-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.hobby-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--surface-3);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: $radius-sm;
}
</style>
