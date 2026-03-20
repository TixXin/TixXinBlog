<!--
  @file ReadingCard.vue
  @description 最近在读卡片组件，展示书籍列表
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card reading-card">
    <h3 class="reading-card__title">
      <Icon name="lucide:book-open" size="14" /> 最近在读    </h3>
    <div class="reading-card__list">
      <div v-for="book in books" :key="book.title" class="reading-card__item">
        <div class="reading-card__cover">
          <Icon name="lucide:book-open" size="12" />
        </div>
        <div>
          <p class="reading-card__book-title">{{ book.title }}</p>
          <p class="reading-card__author">{{ book.author }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BookItem } from '~/features/about/types'

defineProps<{
  books: BookItem[]
}>()
</script>

<style lang="scss" scoped>
.reading-card {
  padding: 1.25rem;
}

.reading-card__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reading-card__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reading-card__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  border-radius: $radius-md;
  background: var(--surface-2);
}

.reading-card__cover {
  width: 2rem;
  height: 2.5rem;
  border-radius: 0.25rem;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-soft);
  flex-shrink: 0;
}

.reading-card__book-title {
  font-size: 0.75rem;
  font-weight: 500;
  margin: 0;
}

.reading-card__author {
  font-size: 10px;
  color: var(--text-soft);
  margin: 0;
}
</style>
