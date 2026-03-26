<!--
  @file LightBox.vue
  @description 全屏图片灯箱，支持背景关闭与 ESC 退出
  @author TixXin
  @since 2026-03-20
-->

<template>
  <Teleport to="body">
    <div
      v-if="visible && photo"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="photo.title"
      @click.self="onClose"
    >
      <button
        type="button"
        class="lightbox__close"
        aria-label="关闭"
        @click="onClose"
      >
        <Icon name="lucide:x" size="24" />
      </button>
      <div class="lightbox__inner">
        <img
          :src="photo.srcLarge"
          :alt="photo.title"
          class="lightbox__img"
        />
        <div class="lightbox__caption">
          <h4 class="lightbox__title">{{ photo.title }}</h4>
          <p class="lightbox__desc">{{ photo.description }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'

const props = defineProps<{
  photo: PhotoItem | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function onClose() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    onClose()
  }
}

watch(
  () => props.visible && props.photo,
  (open) => {
    if (import.meta.client) {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<style lang="scss" scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.lightbox__close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: $transition-fast;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.lightbox__inner {
  max-width: 56rem;
  max-height: 85vh;
  width: 100%;
  padding: 0 1rem;
}

.lightbox__img {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  margin: 0 auto;
  object-fit: contain;
  border-radius: $radius-md;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.lightbox__caption {
  text-align: center;
  margin-top: 1rem;
}

.lightbox__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.lightbox__desc {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}
</style>
