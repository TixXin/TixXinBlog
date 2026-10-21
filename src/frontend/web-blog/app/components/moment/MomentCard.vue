<!--
  @file MomentCard.vue
  @description 朋友圈单条动态卡片，含点赞动画、评论区、多图灯箱
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-card" :class="{ 'is-pinned': moment.isPinned }">
    <MomentUserPopover :profile="ownerProfile" is-owner placement="top">
      <div class="moment-card__avatar">
        <CommonContentImage
          :src="ownerProfile.avatar || '/avatar.svg'"
          :alt="ownerProfile.name"
          width="44"
          height="44"
          class="moment-card__avatar-img"
          format="webp"
        />
      </div>
    </MomentUserPopover>

    <div class="moment-card__body">
      <div class="moment-card__header">
        <span class="moment-card__author">{{ ownerProfile.name }}</span>
        <span v-if="moment.mood" class="moment-card__mood">{{ moment.mood }}</span>
        <span v-if="moment.isPinned" class="moment-card__pin" :aria-label="$t('flash-moment.momentCard.pinned')">
          <Icon name="lucide:pin" size="11" />
          {{ $t('flash-moment.momentCard.pinned') }}
        </span>
      </div>

      <!-- eslint-disable-next-line vue/no-v-html -- 输入已通过 DOMPurify 净化 -->
      <div ref="contentRef" class="moment-card__content markdown-body" v-html="renderedContent" />
      <CommonMarkdownImages :root="contentRef" :html="renderedContent" />

      <!-- 话题标签：点击跳转话题聚合页 -->
      <div v-if="moment.topics && moment.topics.length > 0" class="moment-card__topics">
        <NuxtLink
          v-for="topic in moment.topics"
          :key="topic"
          :to="`/moments/topic/${encodeURIComponent(topic)}`"
          class="moment-card__topic-tag"
        >
          #{{ topic }}
        </NuxtLink>
      </div>

      <!-- 图片网格与灯箱 -->
      <MomentCardImages :images="moment.images" :image-alts="moment.imageAlts" />

      <!-- 引用卡片：站内文章优先，否则外链 OG 卡 -->
      <MomentArticleCard v-if="moment.linkedArticle" :article="moment.linkedArticle" />
      <MomentLinkCard v-else-if="moment.linkedLink" :link="moment.linkedLink" />

      <!-- 底部元信息 + 操作 -->
      <MomentCardFooter
        :moment-id="moment.id"
        :formatted-date="formattedDate"
        :location="moment.location"
        :device="moment.device"
        :detail-query="detailQuery"
        :likes="likes"
        :is-liked="isLiked"
        :comment-count="commentCount"
        :show-comments="showComments"
        :like-pending="state?.likePending"
        :syncing="syncing"
        @toggle-comments="toggleComments"
        @like="handleLike"
      />

      <!-- 评论区 -->
      <Transition name="comment-slide">
        <MomentCommentSection
          v-if="showComments"
          :comments="state?.comments ?? moment.comments ?? []"
          :draft="state?.draft ?? ''"
          :submitting="state?.submitting"
          :submit-error="state?.submitError"
          :notice="state?.notice"
          :loading="state?.loading"
          :load-error="state?.loadError"
          :has-more="!state?.initialized || (state?.comments.length ?? 0) < (state?.total ?? 0)"
          @update:draft="$emit('draft', { id: moment.id, value: $event })"
          @submit="$emit('comment', { id: moment.id, ...$event })"
          @load-more="$emit('comments', moment.id)"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MomentCommentSubmission, MomentItem, MomentUserProfile } from '~/features/moment/types'
import type { MomentInteractionState } from '~/features/moment/session'
import { renderMomentMarkdown } from '~/composables/useMomentMarkdown'

const props = defineProps<{
  moment: MomentItem
  ownerProfile: MomentUserProfile
  state?: MomentInteractionState
  syncing?: boolean
  detailQuery?: Record<string, string>
}>()

const emit = defineEmits<{
  like: [value: { id: string; liked: boolean; complete: (success: boolean) => void }]
  draft: [value: { id: string; value: string }]
  comment: [submission: MomentCommentSubmission]
  comments: [id: string]
}>()

// 与日期筛选和日历采用同一 UTC 日期键。
const formattedDate = computed(() => props.moment.date.slice(0, 10))
const siteUrl = useSiteUrl()
const { t } = useI18n()
const renderedContent = computed(() => renderMomentMarkdown(props.moment.content, { siteUrl, t }))
const contentRef = ref<HTMLElement | null>(null)

const isLiked = computed(() => props.moment.isLiked)
const likes = computed(() => props.moment.likes)
const commentCount = computed(() => props.moment.commentCount ?? props.moment.comments?.length ?? 0)
const showComments = ref((props.moment.comments?.length ?? 0) > 0)

function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value && !props.state?.initialized) emit('comments', props.moment.id)
}

function handleLike(complete: (success: boolean) => void) {
  emit('like', {
    id: props.moment.id,
    liked: !props.moment.isLiked,
    complete,
  })
}
</script>

<style lang="scss" scoped>
.moment-card {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border-soft);

  &:last-child {
    border-bottom: none;
  }
}

.moment-card__avatar {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: $radius-md;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
}

.moment-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-card__body {
  flex: 1;
  min-width: 0;
}

.moment-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.moment-card__author {
  font-weight: 600;
  color: var(--accent-text);
  font-size: 1rem;
}

.moment-card__mood {
  font-size: 0.8125rem;
  color: var(--text-soft);
  padding: 0.0625rem 0.5rem;
  background: var(--surface-2);
  border-radius: $radius-full;
  line-height: 1.3;
}

.moment-card__pin {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  padding: 0.0625rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: $radius-sm;
  line-height: 1.4;
}

.moment-card__content {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 0.5rem;
  word-break: break-word;

  // Markdown 元素样式：闪念内容短小，样式克制
  :deep(p) {
    margin: 0 0 0.4rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(a) {
    color: var(--accent-text);
    text-decoration: none;
    border-bottom: 1px dotted currentColor;

    &:hover {
      opacity: 0.85;
    }
  }

  :deep(strong) {
    font-weight: 600;
    color: var(--text-strong, var(--text-main));
  }

  :deep(em) {
    font-style: italic;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.25rem;
    margin: 0.25rem 0 0.4rem;
  }

  :deep(li) {
    margin: 0.125rem 0;
  }

  // markdown-it-task-lists 输出：<li class="task-list-item">
  :deep(.task-list-item) {
    list-style: none;
    margin-left: -1.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  :deep(.task-list-item-checkbox) {
    flex-shrink: 0;
    margin: 0;
    accent-color: var(--accent);
    cursor: var(--interaction-cursor, default);
  }

  :deep(blockquote) {
    margin: 0.4rem 0;
    padding: 0.25rem 0.75rem;
    border-left: 3px solid var(--accent);
    background: var(--surface-2);
    border-radius: 0 $radius-sm $radius-sm 0;
    color: var(--text-soft);
  }

  :deep(code) {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.875em;
    padding: 0.125rem 0.375rem;
    background: var(--surface-2);
    border-radius: $radius-sm;
    color: var(--accent-text);
  }

  :deep(pre) {
    margin: 0.5rem 0;
    padding: 0.75rem 1rem;
    background: var(--surface-2);
    border-radius: $radius-sm;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.5;

    code {
      padding: 0;
      background: transparent;
      color: var(--text-main);
    }
  }

  :deep(hr) {
    margin: 0.75rem 0;
    border: none;
    border-top: 1px dashed var(--border-soft);
  }
}

// 话题标签
.moment-card__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.moment-card__topic-tag {
  position: relative;
  font-size: 0.75rem;
  color: var(--accent-text);
  background: var(--accent-soft);
  padding: 0.125rem 0.5rem;
  border-radius: $radius-full;
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: -3px -3px;
  }

  &:hover {
    color: #fff;
    background: var(--accent-action);
  }
}

// 评论区展开过渡
.comment-slide-enter-active {
  transition:
    opacity 0.22s ease-out,
    transform 0.22s ease-out,
    max-height 0.22s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.comment-slide-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in,
    max-height 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.comment-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

.comment-slide-enter-to {
  max-height: 500px;
}

.comment-slide-leave-from {
  max-height: 500px;
}

.comment-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}
</style>
