<!--
  @file StickyHeader.vue
  @description 文章详情页粘性顶栏：返回、标题与元信息
  @author TixXin
  @since 2026-03-20
-->

<template>
  <header class="article-sticky-header">
    <div class="article-sticky-header__inner">
      <NuxtLink to="/articles" class="article-sticky-header__back">
        <Icon name="lucide:arrow-left" size="12" />
        <span>返回文章</span>
      </NuxtLink>
      <h1 class="article-sticky-header__title">{{ title }}</h1>
      <div class="article-sticky-header__meta">
        <span class="article-sticky-header__meta-item">
          <Icon name="lucide:calendar" size="12" />
          {{ date }}
        </span>
        <span class="article-sticky-header__meta-item">
          <Icon name="lucide:folder" size="12" />
          {{ category }}
        </span>
        <span class="article-sticky-header__meta-item">
          <Icon name="lucide:clock" size="12" />
          {{ readTime }}
        </span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  category: string
  date: string
  readTime: string
}>()
</script>

<style lang="scss" scoped>
.article-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 0 2rem;
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
  transition: $transition-colors;
}

.article-sticky-header__inner {
  padding: 0.75rem 0;
}

.article-sticky-header__back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 0.375rem;
  transition: $transition-fast;

  &:hover {
    color: var(--text-main);
  }
}

.article-sticky-header__title {
  font-family: $font-family-base;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-sticky-header__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.article-sticky-header__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
