<!--
  @file LightBox.vue
  @description 全屏图片灯箱，支持背景关闭与 ESC 退出
  @author TixXin
  @since 2026-03-20
-->

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dialogRef"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="photo?.title || '照片预览'"
      tabindex="-1"
      @click.self="onClose"
      @keydown.left.prevent="ready && canPrevious && !pending && $emit('previous')"
      @keydown.right.prevent="ready && canNext && !pending && $emit('next')"
    >
      <button type="button" class="lightbox__close" aria-label="关闭" :disabled="!ready" @click="onClose">
        <Icon name="lucide:x" size="24" />
      </button>
      <div class="lightbox__inner">
        <p v-if="pending" role="status" class="lightbox__desc">正在读取作品…</p>
        <p v-if="error" role="alert" class="lightbox__desc">
          {{ error }} <button type="button" :disabled="!ready || pending" @click="$emit('retry')">重新读取</button>
        </p>
        <CommonImageFrame
          v-if="photo"
          :src="photo.srcLarge"
          :alt="photo.title"
          :width="photo.width"
          :height="photo.height"
          fit="contain"
          loading="eager"
          max-height="75vh"
          class="lightbox__img"
        />
        <div v-if="photo" class="lightbox__caption" aria-live="polite">
          <h4 class="lightbox__title">{{ photo.title }}</h4>
          <p class="lightbox__desc">{{ photo.description }}</p>
          <p class="lightbox__desc">
            {{ photo.date ? `拍摄于 ${photo.date}` : '拍摄日期未填写'
            }}<template v-if="photo.location"> · {{ photo.location }}</template
            ><template v-if="photo.device"> · {{ photo.device }}</template>
          </p>
        </div>
        <nav class="lightbox__navigation" aria-label="切换照片">
          <button type="button" :disabled="!ready || !canPrevious || pending" @click="$emit('previous')">
            <Icon name="lucide:chevron-left" />上一张</button
          ><button type="button" :disabled="!ready || !canNext || pending" @click="$emit('next')">
            下一张<Icon name="lucide:chevron-right" />
          </button>
        </nav>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'

const props = defineProps<{
  photo: PhotoItem | null
  visible: boolean
  pending?: boolean
  error?: string
  canPrevious?: boolean
  canNext?: boolean
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
  retry: []
}>()
const ready = ref(false)
onMounted(() => {
  ready.value = true
})

function onClose() {
  if (ready.value) emit('close')
}

const dialogRef = ref<HTMLElement | null>(null)
useModalFocus(() => props.visible, dialogRef, { close: onClose })
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.lightbox__inner {
  max-width: 56rem;
  max-height: 90dvh;
  overflow-y: auto;
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
.lightbox__navigation {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}
.lightbox button {
  min-height: 44px;
  color: white;
}
.lightbox__navigation button,
.lightbox__desc button {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ffffff55;
  border-radius: 0.5rem;
  background: #ffffff18;
}
.lightbox button:disabled {
  opacity: 0.4;
}

.lightbox__caption {
  overflow-wrap: anywhere;
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
