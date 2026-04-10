<!--
  @file MomentArticleCard.vue
  @description 朋友圈动态中引用的文章卡片，点击跳转文章详情
  @author TixXin
  @since 2026-04-10
-->

<template>
  <NuxtLink :to="article.url" class="moment-article-card">
    <div v-if="article.cover" class="moment-article-card__cover">
      <img :src="article.cover" :alt="article.title" loading="lazy">
    </div>
    <div class="moment-article-card__body">
      <div class="moment-article-card__title">
        <Icon name="lucide:file-text" size="14" class="moment-article-card__icon" />
        {{ article.title }}
      </div>
      <p class="moment-article-card__summary">{{ article.summary }}</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { MomentLinkedArticle } from '~/features/moment/types'

defineProps<{
  article: MomentLinkedArticle
}>()
</script>

<style lang="scss" scoped>
.moment-article-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  overflow: hidden;

  &:hover {
    border-color: var(--accent);
    background: var(--surface-3);
  }
}

.moment-article-card__cover {
  flex-shrink: 0;
  width: 80px;
  height: 60px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.moment-article-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.moment-article-card__title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.moment-article-card__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.moment-article-card__summary {
  font-size: 0.75rem;
  color: var(--text-soft);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
