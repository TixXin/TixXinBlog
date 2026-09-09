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
        <NuxtImg
          :src="ownerProfile.avatar || '/avatar.svg'"
          :alt="ownerProfile.name"
          width="44"
          height="44"
          class="moment-card__avatar-img"
          format="webp"
          @error="avatarError = true"
        />
        <div v-if="avatarError" class="moment-card__avatar-fallback">
          <Icon name="lucide:user" size="24" />
        </div>
      </div>
    </MomentUserPopover>

    <div class="moment-card__body">
      <div class="moment-card__header">
        <span class="moment-card__author">{{ ownerProfile.name }}</span>
        <span v-if="moment.mood" class="moment-card__mood" :title="moment.mood">{{ moment.mood }}</span>
        <span v-if="moment.isPinned" class="moment-card__pin" aria-label="置顶">
          <Icon name="lucide:pin" size="11" />
          置顶
        </span>
      </div>

      <!-- eslint-disable-next-line vue/no-v-html -- 输入已通过 DOMPurify 净化 -->
      <div class="moment-card__content markdown-body" v-html="renderedContent" />

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

      <!-- 图片网格 -->
      <div v-if="moment.images && moment.images.length > 0" class="moment-card__images" :class="gridClass">
        <button
          v-for="(img, idx) in moment.images"
          :key="idx"
          type="button"
          class="moment-card__image-wrap"
          :aria-label="`查看动态配图 ${idx + 1}`"
          @click="openLightBox(idx)"
        >
          <img
            :src="img"
            :alt="moment.imageAlts?.[idx] || `动态配图 ${idx + 1}`"
            class="moment-card__image"
            loading="lazy"
          />
        </button>
      </div>

      <!-- 引用卡片：站内文章优先，否则外链 OG 卡 -->
      <MomentArticleCard v-if="moment.linkedArticle" :article="moment.linkedArticle" />
      <MomentLinkCard v-else-if="moment.linkedLink" :link="moment.linkedLink" />

      <!-- 底部元信息 + 操作 -->
      <div class="moment-card__footer">
        <div class="moment-card__meta">
          <NuxtLink
            :to="{ path: `/moments/${moment.id}`, query: detailQuery }"
            class="moment-card__time"
            :aria-label="`查看动态详情 · ${formattedDate}`"
          >
            {{ formattedDate }}
          </NuxtLink>
          <span v-if="moment.location" class="moment-card__location">
            <Icon name="lucide:map-pin" size="12" />
            {{ moment.location }}
          </span>
          <span v-if="moment.device" class="moment-card__device">
            <Icon name="lucide:smartphone" size="12" />
            {{ moment.device }}
          </span>
        </div>

        <div class="moment-card__actions">
          <!-- 评论按钮 -->
          <button
            type="button"
            class="moment-action-btn"
            :class="{ 'is-active': showComments }"
            aria-label="查看动态评论"
            :aria-expanded="showComments"
            @click="toggleComments"
          >
            <Icon name="lucide:message-square" size="15" />
            <span v-if="commentCount > 0" class="moment-action-count">{{ commentCount }}</span>
          </button>

          <!-- 点赞按钮 -->
          <button
            type="button"
            class="moment-action-btn"
            :class="{ 'is-liked': isLiked }"
            :aria-label="isLiked ? '取消动态点赞' : '点赞动态'"
            :aria-pressed="isLiked"
            :disabled="state?.likePending || syncing || !hydrated"
            @click="toggleLike"
          >
            <span class="like-icon-wrap" :class="{ 'like-icon-wrap--burst': justLiked }">
              <Icon name="lucide:heart" size="15" :class="{ 'fill-current': isLiked }" />
            </span>
            <span class="moment-action-count-wrap">
              <Transition name="like-count">
                <span v-if="likes > 0" :key="likes" class="moment-action-count">{{ likes }}</span>
              </Transition>
            </span>
          </button>
        </div>
      </div>

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
          @submit="$emit('comment', moment.id)"
          @load-more="$emit('comments', moment.id)"
        />
      </Transition>
    </div>

    <!-- 多图灯箱 -->
    <ClientOnly>
      <MomentLightBox
        :images="moment.images ?? []"
        :current-index="lightBoxIndex"
        :visible="lightBoxVisible"
        @close="closeLightBox"
        @change="onLightBoxChange"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { MomentItem, MomentUserProfile } from '~/features/moment/types'
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
  comment: [id: string]
  comments: [id: string]
}>()
const avatarError = ref(false),
  hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
watch(
  () => props.ownerProfile.avatar,
  () => {
    avatarError.value = false
  },
)
// 与日期筛选和日历采用同一 UTC 日期键。
const formattedDate = computed(() => props.moment.date.slice(0, 10))
const renderedContent = computed(() => renderMomentMarkdown(props.moment.content))
const isLiked = computed(() => props.moment.isLiked)
const likes = computed(() => props.moment.likes)
const commentCount = computed(() => props.moment.commentCount ?? props.moment.comments?.length ?? 0)
const showComments = ref((props.moment.comments?.length ?? 0) > 0)
function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value && !props.state?.initialized) emit('comments', props.moment.id)
}
const justLiked = ref(false)
const { reducedMotion } = useMotionPreference()
let likeTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
function finishLike() {
  if (likeTimer) clearTimeout(likeTimer)
  justLiked.value = false
}
watch(reducedMotion, (value) => {
  if (value) finishLike()
})
onBeforeUnmount(() => {
  alive = false
  finishLike()
})
function toggleLike() {
  if (props.state?.likePending || props.syncing || !hydrated.value) return
  const liked = !isLiked.value
  emit('like', {
    id: props.moment.id,
    liked,
    complete(success) {
      if (!success || !liked || !alive || reducedMotion.value) return
      finishLike()
      justLiked.value = true
      likeTimer = setTimeout(finishLike, 400)
    },
  })
}
const gridClass = computed(() => {
  const size = props.moment.images?.length || 0
  return size === 1 ? 'grid-1' : size === 2 || size === 4 ? 'grid-2' : 'grid-3'
})
const lightBoxVisible = ref(false),
  lightBoxIndex = ref(0)
function openLightBox(index: number) {
  lightBoxIndex.value = index
  lightBoxVisible.value = true
}
function closeLightBox() {
  lightBoxVisible.value = false
}
function onLightBoxChange(index: number) {
  lightBoxIndex.value = index
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
    cursor: default;
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

  &:hover {
    color: #fff;
    background: var(--accent);
  }
}

// 图片网格
.moment-card__images {
  display: grid;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  max-width: 400px;

  &.grid-1 {
    grid-template-columns: 1fr;

    .moment-card__image-wrap {
      max-width: 240px;
      aspect-ratio: auto;
      max-height: 300px;
    }
  }

  &.grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  &.grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

.moment-card__image-wrap {
  aspect-ratio: 1;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-2);
  cursor: zoom-in;
}

.moment-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .moment-card__image-wrap:hover & {
    transform: scale(1.05);
  }
}

// 底部栏
.moment-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.moment-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-faint);
}

.moment-card__location,
.moment-card__device {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-soft);
}

// 时间戳兼详情入口：点击跳转单条动态详情页
.moment-card__time {
  color: var(--text-faint);
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }
}

// 操作按钮
.moment-card__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.moment-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 0.8125rem;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent-text);
  }

  &.is-liked {
    color: var(--danger);

    .fill-current {
      fill: currentColor;
    }
  }
}

.moment-action-count-wrap {
  position: relative;
  min-width: 0.75rem;
}

// 点赞动画 — 心形弹跳
.like-icon-wrap {
  position: relative;
  display: inline-flex;

  &--burst {
    animation: like-pop 0.35s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    // 粒子效果（6个圆点从中心向外扩散）
    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 2px;
      border-radius: 50%;
      animation: like-particles 0.5s ease-out forwards;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }
}

@keyframes like-pop {
  0% {
    transform: scale(1);
  }

  25% {
    transform: scale(1.35);
  }

  50% {
    transform: scale(0.88);
  }

  75% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes like-particles {
  0% {
    opacity: 1;
    box-shadow:
      0 0 0 var(--danger),
      0 0 0 var(--danger),
      0 0 0 #f59e0b,
      0 0 0 #f59e0b,
      0 0 0 #ec4899,
      0 0 0 #ec4899;
  }

  100% {
    opacity: 0;
    box-shadow:
      -8px -10px 0 var(--danger),
      8px -10px 0 var(--danger),
      -12px 0 0 #f59e0b,
      12px 0 0 #f59e0b,
      -6px 10px 0 #ec4899,
      6px 10px 0 #ec4899;
  }
}

// 点赞数字过渡
.like-count-enter-active {
  animation: count-float-in 0.3s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.like-count-leave-active {
  animation: count-float-out 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  position: absolute;
  left: 0;
}

@keyframes count-float-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes count-float-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }

  to {
    opacity: 0;
    transform: translateY(-6px);
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
