<!--
  @file MomentCard.vue
  @description 朋友圈单条动态卡片
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-card">
    <div class="moment-card__avatar">
      <NuxtImg
        src="/avatar.svg"
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

    <div class="moment-card__body">
      <div class="moment-card__header">
        <span class="moment-card__author">TixXin</span>
      </div>

      <div class="moment-card__content">
        {{ moment.content }}
      </div>

      <div v-if="moment.images && moment.images.length > 0" class="moment-card__images" :class="gridClass">
        <div v-for="(img, idx) in moment.images" :key="idx" class="moment-card__image-wrap" @click="openLightBox(idx)">
          <img
            :src="img"
            alt="图片"
            class="moment-card__image"
            loading="lazy"
          >
        </div>
      </div>

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
          <button
            type="button"
            class="moment-action-btn"
            :class="{ 'is-liked': isLiked }"
            aria-label="点赞"
            @click="toggleLike"
          >
            <Icon :name="isLiked ? 'lucide:heart' : 'lucide:heart'" size="15" :class="{ 'fill-current': isLiked }" />
            <span v-if="likes > 0" class="moment-action-count">{{ likes }}</span>
          </button>
        </div>
      </div>
    </div>

    <ClientOnly>
      <GalleryLightBox :photo="lightBoxPhoto" :visible="lightBoxVisible" @close="closeLightBox" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { MomentItem } from '~/features/moment/types'
import { formatRelativeDate } from '~/composables/useRelativeDate'

const props = defineProps<{
  moment: MomentItem
}>()

const avatarError = ref(false)

const formattedDate = computed(() => formatRelativeDate(props.moment.date))

const isLiked = ref(props.moment.isLiked)
const likes = ref(props.moment.likes)

function toggleLike() {
  if (isLiked.value) {
    isLiked.value = false
    likes.value--
  } else {
    isLiked.value = true
    likes.value++
  }
}

const gridClass = computed(() => {
  const len = props.moment.images?.length || 0
  if (len === 1) return 'grid-1'
  if (len === 2 || len === 4) return 'grid-2'
  return 'grid-3'
})

// 灯箱逻辑
const lightBoxVisible = ref(false)
const lightBoxPhoto = ref<{
  id: number
  title: string
  description: string
  src: string
  srcLarge: string
  category: string
  date: string
  location: string
} | null>(null)

function openLightBox(index: number) {
  const src = props.moment.images?.[index]
  if (!src) return
  lightBoxPhoto.value = {
    id: index,
    title: '',
    description: '',
    src,
    srcLarge: src,
    category: 'moment',
    date: props.moment.date,
    location: props.moment.location ?? '',
  }
  lightBoxVisible.value = true
}

function closeLightBox() {
  lightBoxVisible.value = false
  lightBoxPhoto.value = null
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
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

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
  color: var(--accent-soft);
}

.moment-card__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
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

  &.is-liked {
    color: var(--danger);

    .fill-current {
      fill: currentColor;
    }
  }
}
</style>
