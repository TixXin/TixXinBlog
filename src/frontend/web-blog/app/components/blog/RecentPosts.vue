<!--
  @file RecentPosts.vue
  @description 首页精简版近期文章列表
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="recent-posts">
    <div class="recent-posts__header">
      <h2 class="recent-posts__title">
        <Icon name="lucide:clock" size="18" class="recent-posts__icon" />
        近期文章
      </h2>
      <NuxtLink to="/articles" class="recent-posts__more">
        全部文章
        <Icon name="lucide:chevron-right" size="14" />
      </NuxtLink>
    </div>

    <div class="recent-posts__list">
      <NuxtLink v-for="post in posts" :key="post.id" :to="`/articles/${post.id}`" class="recent-post-item">
        <div class="recent-post-item__content">
          <h3 class="recent-post-item__title">{{ post.title }}</h3>
          <div class="recent-post-item__meta">
            <span class="meta-item">
              <Icon name="lucide:calendar" size="12" />
              {{ formatRelativeDate(post.date) }}
            </span>
            <span class="meta-item">
              <Icon name="lucide:folder" size="12" />
              {{ post.category }}
            </span>
          </div>
        </div>
        <div v-if="post.cover" class="recent-post-item__cover">
          <NuxtImg
            :src="post.cover"
            :alt="post.title"
            width="120"
            height="80"
            class="recent-post-item__img"
            format="webp"
            loading="lazy"
          />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'
import { formatRelativeDate } from '~/composables/useRelativeDate'

defineProps<{
  posts: PostItem[]
}>()
</script>

<style lang="scss" scoped>
.recent-posts {
  background: var(--surface-1);
  border-radius: $radius-lg;
  border: 1px solid var(--border-soft);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-card);
}

.recent-posts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.recent-posts__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.recent-posts__icon {
  color: var(--accent);
}

.recent-posts__more {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  transition: $transition-colors;

  &:hover {
    color: var(--accent);
  }
}

.recent-posts__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recent-post-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: $radius-md;
  background: var(--surface-2);
  border: 1px solid transparent;
  transition: $transition-colors;

  &:hover {
    background: var(--surface-3);
    border-color: var(--border-hover);

    .recent-post-item__title {
      color: var(--accent);
    }
  }
}

.recent-post-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.recent-post-item__title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-main);
  margin: 0 0 0.5rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}

.recent-post-item__meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--text-faint);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.recent-post-item__cover {
  width: 100px;
  height: 68px;
  border-radius: $radius-sm;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface-3);

  @media (min-width: $breakpoint-sm) {
    width: 120px;
    height: 80px;
  }
}

.recent-post-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
