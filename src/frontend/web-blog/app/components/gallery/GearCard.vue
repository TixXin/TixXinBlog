<!--
  @file GearCard.vue
  @description 画廊右侧器材信息卡片
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="card gear-card">
    <h3 class="gear-card__title">
      <Icon name="lucide:info" size="16" />
      <span>器材信息</span>
    </h3>
    <ul class="gear-card__list">
      <li
        v-for="(item, index) in gear"
        :key="`${item.name}-${index}`"
        class="gear-card__item"
      >
        <div class="gear-card__icon-wrap">
          <Icon :name="item.icon" size="16" />
        </div>
        <div class="gear-card__text">
          <p class="gear-card__name">{{ item.name }}</p>
          <p class="gear-card__desc">{{ item.description }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { GearItem } from '~/features/gallery/types'

defineProps<{
  gear: GearItem[]
}>()
</script>

<style lang="scss" scoped>
.gear-card {
  padding: 1.25rem;
}

.gear-card__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);

  :deep(svg),
  :deep(.icon) {
    color: var(--text-soft);
  }
}

.gear-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gear-card__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  border-radius: $radius-md;
  background: var(--surface-2);
}

.gear-card__icon-wrap {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  background: var(--border-soft);
  color: var(--text-muted);
}

.gear-card__text {
  min-width: 0;
}

.gear-card__name {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.gear-card__desc {
  margin: 0.125rem 0 0;
  font-size: 10px;
  color: var(--text-soft);
}
</style>
