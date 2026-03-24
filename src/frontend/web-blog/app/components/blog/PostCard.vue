<!--
  @file PostCard.vue
  @description 文章列表项组件，展示单篇文章的缩略图、标题、摘要、标签和元信息
  @author TixXin
  @since 2025-03-17
-->

<template>
  <article class="post-item" @click="navigateToPost">
    <div v-if="post.cover" class="post-item__cover-bg">
      <img :src="post.cover" alt="Cover" loading="lazy" />
    </div>

    <div class="post-item__content">
      <div class="post-item__header">
        <div class="post-item__title-wrapper">
          <span v-if="post.pinned" class="post-item__pin">
            <Icon name="lucide:pin" size="12" /> 置顶
          </span>
          <h2 class="post-item__title">
            <span :class="{ 'post-item__title-highlight': !!post.cover }">{{ post.title }}</span>
          </h2>
        </div>
        <div class="post-item__date">{{ formattedDate }}</div>
      </div>
      
      <p class="post-item__summary line-clamp-2">{{ post.summary }}</p>
      
      <div class="post-item__footer">
        <div class="post-item__tags">
          <span
            v-for="tag in post.tags"
            :key="tag.label"
            class="tag-badge"
            :style="tagStyle(tag.color)"
          >
            # {{ tag.label }}
          </span>
        </div>
        
        <div class="post-item__meta-bottom">
          <span class="post-item__meta-item">{{ post.folder }}</span>
          <span class="post-item__dot" />
          <span class="post-item__meta-item"><Icon name="lucide:clock" size="12" /> {{ post.readTime }} min</span>
          <span class="post-item__meta-item"><Icon name="lucide:eye" size="12" /> {{ post.views.toLocaleString() }}</span>
          <span class="post-item__meta-item"><Icon name="lucide:heart" size="12" /> {{ post.likes }}</span>
          <span class="post-item__meta-item"><Icon name="lucide:message-square" size="12" /> {{ post.comments }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'
import { formatRelativeDate } from '~/composables/useRelativeDate'

const props = defineProps<{
  post: PostItem
}>()

const formattedDate = computed(() => formatRelativeDate(props.post.date))

function navigateToPost() {
  // placeholder for future navigation
}

const tagColorMap: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'var(--tag-emerald-bg)', text: 'var(--tag-emerald-text)', border: 'var(--tag-emerald-border)' },
  rose: { bg: 'var(--tag-rose-bg)', text: 'var(--tag-rose-text)', border: 'var(--tag-rose-border)' },
  sky: { bg: 'var(--tag-sky-bg)', text: 'var(--tag-sky-text)', border: 'var(--tag-sky-border)' },
  orange: { bg: 'var(--tag-orange-bg)', text: 'var(--tag-orange-text)', border: 'var(--tag-orange-border)' },
  blue: { bg: 'var(--tag-blue-bg)', text: 'var(--tag-blue-text)', border: 'var(--tag-blue-border)' },
  amber: { bg: 'var(--tag-amber-bg)', text: 'var(--tag-amber-text)', border: 'var(--tag-amber-border)' },
}

function tagStyle(color: string) {
  const c = tagColorMap[color] ?? tagColorMap.blue!
  return {
    background: c!.bg,
    color: c!.text,
    borderColor: c!.border,
  }
}
</script>

<style lang="scss" scoped>
.post-item {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  min-height: var(--post-card-min-h, 112px);
  max-height: var(--post-card-max-h, 155px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: transparent;
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  overflow: hidden;

  &:hover {
    background-color: var(--surface-2);
    border-color: transparent;
    box-shadow: var(--shadow-card);

    .post-item__title {
      color: var(--accent);
    }

    &:has(.post-item__cover-bg) .post-item__title {
      color: var(--accent);
    }

    .post-item__cover-bg img {
      transform: scale(1.05);
    }
  }

  @media (min-width: $breakpoint-sm) {
    padding: 1rem 1.25rem;
    gap: 1rem;
  }
}

/* 背景图层 */
.post-item__cover-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%; /* 移动端默认全宽 */
  z-index: 0;
  overflow: hidden;
  opacity: 0.15; /* 移动端保持低透明度 */
  pointer-events: none; /* 防止遮挡点击事件 */

  @media (min-width: $breakpoint-sm) {
    width: 45%; /* 桌面端占据右侧45%空间 */
    opacity: 1; /* 桌面端完全显示 */
    /* 左侧约 25% 为透明渐变过渡，右侧完全不透明 */
    mask-image: linear-gradient(to right, transparent 0%, black 35%, black 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 35%, black 100%);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }
}

.post-item__content {
  position: relative;
  z-index: 1; /* 确保内容在背景图之上 */
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.post-item__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.post-item__title-wrapper {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.post-item__date {
  font-size: 0.75rem;
  color: var(--text-soft);
  white-space: nowrap;
  flex-shrink: 0;
  padding-top: 0.25rem;
  position: relative;
  z-index: 2;
  
  /* 有封面：磨砂叠层（亮色浅玻璃 / 暗色暗底，由全局 token 控制） */
  .post-item:has(.post-item__cover-bg) & {
    background: var(--surface-cover-overlay);
    backdrop-filter: var(--cover-overlay-backdrop);
    border: var(--cover-overlay-border);
    box-shadow: var(--cover-overlay-shadow);
    padding: 0.25rem 0.5rem;
    border-radius: $radius-sm;
    color: var(--text-on-cover-muted);
  }
}

.post-item__pin {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #ef4444;
  font-weight: 600;
  font-size: 0.6875rem;
  flex-shrink: 0;
  margin-top: 0.15rem;
  padding: 0.15rem 0.4rem;
  border-radius: $radius-sm;
  line-height: 1.2;
  background: var(--pin-badge-bg);
  border: 1px solid var(--pin-badge-border);
}

.post-item__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-faint);
}

.post-item__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-main);
  transition: color 0.2s;
  position: relative;
  z-index: 2;

  .post-item:has(.post-item__cover-bg) & {
    color: var(--text-on-cover);
    flex: 0 1 auto;
    align-self: flex-start;
    width: fit-content;
    max-width: 100%;
  }

  @media (min-width: $breakpoint-sm) {
    font-size: 1.125rem;
    max-width: 85%;

    .post-item:has(.post-item__cover-bg) & {
      max-width: 85%;
    }
  }
}

/*
 * 换行时每行独立绘制背景（box-decoration-break: clone）。
 * 不在此处使用 backdrop-filter：Chromium 对多行 inline 片段易按「整行行框」铺色。
 * 阴影改用 filter: drop-shadow，轮廓随文字而非矩形。
 */
.post-item__title-highlight {
  display: inline;
  padding: 0.2em 0.45em;
  border-radius: $radius-sm;
  background: var(--surface-cover-overlay);
  border: var(--cover-overlay-border);
  box-shadow: none;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.07));
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.dark .post-item__title-highlight {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
}

.post-item__summary {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 0.25rem;
  position: relative;
  z-index: 2;
  
  @media (min-width: $breakpoint-sm) {
    /* 有封面图时限制宽度，避免文字跑到图片区域 */
    max-width: 55%; 
    
    /* 当没有封面图时，允许简介占满全宽 */
    .post-item:not(:has(.post-item__cover-bg)) & {
      max-width: 100%;
    }
  }
}

.post-item__footer {
  display: flex;
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
  font-size: 0.6875rem;
  color: var(--text-soft);
  padding: 0.3rem 0.625rem;
  border-radius: $radius-sm;
  background: var(--surface-2);
  border: 1px solid transparent;
  box-shadow: none;

  .post-item:has(.post-item__cover-bg) & {
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
