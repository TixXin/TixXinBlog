<!--
  @file MomentCard.vue
  @description 朋友圈单条动态卡片，含点赞动画、评论区、多图灯箱
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-card">
    <MomentUserPopover :profile="ownerProfile" is-owner placement="top">
      <div class="moment-card__avatar">
        <NuxtImg
          src="/avatar-photo.webp"
          alt="TixXin"
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
        <span class="moment-card__author">TixXin</span>
      </div>

      <div class="moment-card__content">
        {{ moment.content }}
      </div>

      <!-- 话题标签 -->
      <div v-if="moment.topics && moment.topics.length > 0" class="moment-card__topics">
        <span v-for="topic in moment.topics" :key="topic" class="moment-card__topic-tag"> #{{ topic }} </span>
      </div>

      <!-- 图片网格 -->
      <div v-if="moment.images && moment.images.length > 0" class="moment-card__images" :class="gridClass">
        <div v-for="(img, idx) in moment.images" :key="idx" class="moment-card__image-wrap" @click="openLightBox(idx)">
          <img :src="img" alt="图片" class="moment-card__image" loading="lazy" >
        </div>
      </div>

      <!-- 引用文章卡片 -->
      <MomentArticleCard v-if="moment.linkedArticle" :article="moment.linkedArticle" />

      <!-- 底部元信息 + 操作 -->
      <div class="moment-card__footer">
        <div class="moment-card__meta">
          <span class="moment-card__time">{{ formattedDate }}</span>
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
            aria-label="点赞"
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
        <MomentCommentSection v-if="showComments" :comments="localComments" @submit="onCommentSubmit" />
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
import type { MomentItem, MomentCommentItem, MomentUserProfile } from '~/features/moment/types'
import { formatRelativeDate } from '~/composables/useRelativeDate'

/** 博主信息，用于头像 hover 卡片 */
const ownerProfile: MomentUserProfile = {
  name: 'TixXin',
  avatar: '/avatar-photo.webp',
  bio: '记录生活点滴，分享技术与日常',
  link: '/',
}

const props = defineProps<{
  moment: MomentItem
}>()



const avatarError = ref(false)

const formattedDate = computed(() => formatRelativeDate(props.moment.date))

// 点赞逻辑
const isLiked = ref(props.moment.isLiked)
const likes = ref(props.moment.likes)
const justLiked = ref(false)

function toggleLike() {
  if (isLiked.value) {
    isLiked.value = false
    likes.value--
  } else {
    isLiked.value = true
    likes.value++
    justLiked.value = true
    setTimeout(() => {
      justLiked.value = false
    }, 600)
  }
}

// 评论逻辑 — 有评论时默认展开
const showComments = ref((props.moment.comments ?? []).length > 0)
const localComments = ref<MomentCommentItem[]>([...(props.moment.comments ?? [])])
const commentCount = computed(() => localComments.value.length)

function toggleComments() {
  showComments.value = !showComments.value
}

function onCommentSubmit(comment: MomentCommentItem) {
  localComments.value.push(comment)
}

// 图片网格
const gridClass = computed(() => {
  const len = props.moment.images?.length || 0
  if (len === 1) return 'grid-1'
  if (len === 2 || len === 4) return 'grid-2'
  return 'grid-3'
})

// 多图灯箱
const lightBoxVisible = ref(false)
const lightBoxIndex = ref(0)

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
  margin-bottom: 0.25rem;
}

.moment-card__author {
  font-weight: 600;
  color: var(--accent);
  font-size: 1rem;
}

.moment-card__content {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
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
  color: var(--accent);
  background: var(--accent-soft);
  padding: 0.125rem 0.5rem;
  border-radius: $radius-full;
  cursor: default;
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

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent);
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
}

.like-count-leave-active {
  animation: count-float-out 0.2s ease-in;
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
  transition: all 0.25s ease-out;
}

.comment-slide-leave-active {
  transition: all 0.2s ease-in;
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
