<!-- @file PostCardMeta.vue @description 文章卡片底部的分类标签与元信息栏 -->
<template>
  <div class="post-item__footer">
    <div class="post-item__tags">
      <span v-for="tag in post.tags" :key="tag.label" class="tag-badge" :style="tagStyle(tag.color)">
        # {{ tag.label }}
      </span>
    </div>

    <div class="post-item__meta-bottom" :class="{ 'post-item__meta-bottom--on-cover': hasCover }">
      <span class="post-item__meta-item">{{ post.folder }}</span>
      <span class="post-item__dot" />
      <span class="post-item__meta-item"><Icon name="lucide:clock" size="12" /> {{ post.readTime }} min</span>
      <span class="post-item__meta-item"><Icon name="lucide:eye" size="12" /> {{ formatNumber(post.views) }}</span>
      <span class="post-item__meta-item"><Icon name="lucide:heart" size="12" /> {{ post.likes }}</span>
      <span class="post-item__meta-item"><Icon name="lucide:message-square" size="12" /> {{ post.comments }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

defineProps<{
  post: PostItem
  hasCover: boolean
}>()

const tagColors = ['emerald', 'rose', 'sky', 'orange', 'blue', 'amber'] as const
const tagStyles: Record<string, { background: string; color: string; borderColor: string }> = Object.fromEntries(
  tagColors.map((c) => [
    c,
    {
      background: `var(--tag-${c}-bg)`,
      color: `var(--tag-${c}-text)`,
      borderColor: `var(--tag-${c}-border)`,
    },
  ]),
)

function tagStyle(color: string) {
  return tagStyles[color] ?? tagStyles.blue!
}
</script>

<style lang="scss" scoped>
.post-item__footer {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: auto;

  @media (min-width: $breakpoint-sm) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

/* 底部元信息栏：无封面时用实色表面，避免浅色主题下仍出现封面专用白描边/阴影 */
.post-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.125rem 0;
}

.post-item__meta-bottom {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  padding: 0.3rem 0.625rem;
  border-radius: $radius-sm;
  background: var(--surface-2);
  border: 1px solid transparent;
  box-shadow: none;

  &--on-cover {
    background: var(--surface-cover-overlay);
    backdrop-filter: var(--cover-overlay-backdrop);
    border: var(--cover-overlay-border);
    box-shadow: var(--cover-overlay-shadow);
    color: var(--text-on-cover-muted);

    .post-item__dot {
      background: currentColor;
      opacity: 0.42;
    }
  }
}

.post-item__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-faint);
}

/* 标签徽章：仅保留文字色，无背景 */
.tag-badge {
  background: transparent !important;
  border: none !important;
  padding: 0.125rem 0;
}

.post-item__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
