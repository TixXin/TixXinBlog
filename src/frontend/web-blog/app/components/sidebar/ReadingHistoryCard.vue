<!--
  @file ReadingHistoryCard.vue
  @description 侧边栏阅读历史卡片，展示最近阅读的文章
  @author TixXin
  @since 2026-04-06
-->

<template>
  <section v-if="history.length" class="card reading-history-card">
    <div class="reading-history-card__header">
      <h3 class="reading-history-card__title"><Icon name="lucide:history" size="16" /> 最近阅读</h3>
      <button type="button" class="reading-history-card__clear" aria-label="清除阅读历史" @click="clearHistory">
        <Icon name="lucide:trash-2" size="12" />
      </button>
    </div>
    <ul class="reading-history-card__list">
      <li v-for="item in displayItems" :key="item.id" class="reading-history-card__item">
        <NuxtLink :to="`/articles/${item.id}`" class="reading-history-card__link">
          <span class="reading-history-card__item-title line-clamp-1">{{ item.title }}</span>
          <span class="reading-history-card__item-date">{{ item.date }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { history, clearHistory } = useReadingHistory()
const displayItems = computed(() => history.value.slice(0, 5))
</script>

<style lang="scss" scoped>
.reading-history-card {
  padding: 1.25rem;
}

.reading-history-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.reading-history-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.reading-history-card__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

.reading-history-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reading-history-card__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: var(--surface-2);
  }
}

.reading-history-card__item-title {
  font-size: 0.8125rem;
  color: var(--text-main);
  flex: 1;
  min-width: 0;
}

.reading-history-card__item-date {
  font-size: 0.6875rem;
  color: var(--text-faint);
  flex-shrink: 0;
}
</style>
