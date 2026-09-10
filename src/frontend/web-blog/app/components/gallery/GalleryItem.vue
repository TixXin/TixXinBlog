<!--
  @file GalleryItem.vue
  @description 画廊瀑布流单张卡片，悬停渐变遮罩与元信息
  @author TixXin
  @since 2026-03-20
-->

<template>
  <article
    class="gallery-item"
    role="button"
    :tabindex="ready ? 0 : -1"
    :aria-disabled="!ready"
    :data-focus-key="`gallery-photo-${photo.id}`"
    :aria-label="`查看照片：${photo.title}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  >
    <CommonImageFrame
      :src="photo.src"
      :alt="photo.title"
      :width="photo.width"
      :height="photo.height"
      class="gallery-item__img"
    />
    <div class="gallery-item__overlay">
      <h4 class="gallery-item__title">{{ photo.title }}</h4>
      <p class="gallery-item__meta">
        {{ [photo.date, photo.location].filter(Boolean).join(' · ') || '拍摄信息未填写' }}
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'

const props = defineProps<{
  photo: PhotoItem
  ready: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
function select() {
  if (props.ready) emit('click')
}
</script>

<style lang="scss" scoped>
.gallery-item {
  position: relative;
  border-radius: $radius-md;
  overflow: hidden;
  cursor: pointer;
  outline: none;

  &[aria-disabled='true'] {
    cursor: default;
  }

  &:focus-visible {
    box-shadow:
      0 0 0 2px var(--surface-1),
      0 0 0 4px var(--accent);
  }
}

.gallery-item__img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: $radius-md;
}

.gallery-item :deep(.image-frame__image) {
  transition: transform 0.24s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.gallery-item:hover :deep(.image-frame__image),
.gallery-item:focus-visible :deep(.image-frame__image) {
  transform: scale(1.05);
}

.gallery-item__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1rem;
  border-radius: $radius-md;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent 55%);
  opacity: 0;
  transition: opacity 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  pointer-events: none;
}

.gallery-item:hover .gallery-item__overlay,
.gallery-item:focus-visible .gallery-item__overlay {
  opacity: 1;
}

.gallery-item__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
}

.gallery-item__meta {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}
</style>
