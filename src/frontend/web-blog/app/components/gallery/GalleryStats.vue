<!--
  @file GalleryStats.vue
  @description 画廊右侧统计卡片，展示照片与拍摄相关数据
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="card gallery-stats">
    <h3 class="gallery-stats__title">
      <Icon name="lucide:camera" size="16" />
      <span>画廊统计</span>
    </h3>
    <ul class="gallery-stats__list">
      <li
        v-for="row in stats"
        :key="row.label"
        class="gallery-stats__row"
      >
        <span class="gallery-stats__label">{{ row.label }}</span>
        <span class="gallery-stats__value">{{ row.value }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { GalleryStat } from '~/features/gallery/types'

defineProps<{
  stats: GalleryStat[]
}>()
</script>

<style lang="scss" scoped>
.gallery-stats {
  padding: 1.25rem;
}

.gallery-stats__title {
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

.gallery-stats__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gallery-stats__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.gallery-stats__label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.gallery-stats__value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
}
</style>
