<!--
  @file RelatedPosts.vue
  @description 文章详情页右侧相关文章列表
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="related card">
    <h3 class="related__title">
      <Icon name="lucide:bookmark" size="16" />
      相关文章
    </h3>
    <ul class="related__list">
      <li v-for="post in posts" :key="post.id" class="related__item">
        <NuxtLink :to="articlePath(post)" class="related__link">
          <p class="related__post-title">{{ post.title }}</p>
          <div class="related__meta">
            <span>{{ post.date }}</span>
            <span class="related__sep">·</span>
            <span>{{ post.category }}</span>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { RelatedPost } from '~/features/post/types'

defineProps<{
  posts: RelatedPost[]
}>()
</script>

<style lang="scss" scoped>
.related {
  padding: 1.25rem;
  border-radius: $radius-card;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.related__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

.related__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.related__item {
  margin: 0;
}

.related__link {
  display: block;
  padding: 0.75rem;
  margin: 0 -0.75rem;
  border-radius: $radius-md;
  text-decoration: none;
  color: inherit;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-3);
  }
}

.related__post-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text-muted);

  .related__link:hover & {
    color: var(--text-main);
  }
}

.related__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.related__sep {
  opacity: 0.7;
}
</style>
