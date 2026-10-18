<!--
  @file MomentArticleCard.vue
  @description 朋友圈动态中引用的文章卡片，点击跳转文章详情
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div class="moment-article-card">
    <div v-if="article.cover" class="moment-article-card__cover">
      <CommonImageFrame
        :key="article.cover"
        :src="article.cover"
        :alt="article.title"
        loading="lazy"
        sizes="80px"
        compact
        @state="updateCoverFailure(article.cover, $event)"
      />
      <NuxtLink
        v-if="!coverFailures[article.cover]"
        :to="article.url"
        :aria-label="`阅读文章：${article.title}`"
        class="moment-article-card__cover-link"
      />
    </div>
    <NuxtLink :to="article.url" class="moment-article-card__body">
      <div class="moment-article-card__title">
        <Icon name="lucide:file-text" size="14" class="moment-article-card__icon" />
        {{ article.title }}
      </div>
      <p class="moment-article-card__summary">{{ article.summary }}</p>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { MomentLinkedArticle } from '~/features/moment/types'

defineProps<{
  article: MomentLinkedArticle
}>()
const coverFailures = ref<Record<string, boolean>>({})
function updateCoverFailure(source: string | undefined, state: 'loading' | 'ready' | 'error' | 'empty') {
  // 按图片地址保存失败状态，重试加载期间保持恢复入口可操作。
  if (source && state !== 'loading') coverFailures.value[source] = state === 'error'
}
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
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  overflow: hidden;

  &:hover {
    border-color: var(--accent);
    background: var(--surface-3);
  }
}

.moment-article-card__cover {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 60px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);

  :deep(.image-frame) {
    width: 100%;
    height: 100%;
  }
}

.moment-article-card__cover-link {
  position: absolute;
  inset: 0;
  border-radius: inherit;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }
}

.moment-article-card__body {
  text-decoration: none;
  color: inherit;
  border-radius: $radius-sm;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
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
  color: var(--accent-text);
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
