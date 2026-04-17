<!--
  @file FlashImageLightBox.vue
  @description 闪念多图灯箱：键盘左右切换 / Esc 关闭，与 MomentLightBox 同款交互但模块独立
  @author TixXin
  @since 2026-04-17
-->

<template>
  <Teleport to="body">
    <Transition name="flash-lightbox-fade">
      <div
        v-if="visible && images.length > 0"
        class="flash-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onClose"
      >
        <button type="button" class="flash-lightbox__close" aria-label="关闭" @click="onClose">
          <Icon name="lucide:x" size="24" />
        </button>

        <button
          v-if="currentIndex > 0"
          type="button"
          class="flash-lightbox__nav flash-lightbox__nav--prev"
          aria-label="上一张"
          @click="onPrev"
        >
          <Icon name="lucide:chevron-left" size="28" />
        </button>

        <div class="flash-lightbox__content" @click.self="onClose">
          <img :src="images[currentIndex]" alt="预览图片" class="flash-lightbox__img" >
          <div v-if="images.length > 1" class="flash-lightbox__counter">
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </div>

        <button
          v-if="currentIndex < images.length - 1"
          type="button"
          class="flash-lightbox__nav flash-lightbox__nav--next"
          aria-label="下一张"
          @click="onNext"
        >
          <Icon name="lucide:chevron-right" size="28" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  images: string[]
  currentIndex: number
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  change: [index: number]
}>()

function onClose() {
  emit('close')
}
function onPrev() {
  if (props.currentIndex > 0) emit('change', props.currentIndex - 1)
}
function onNext() {
  if (props.currentIndex < props.images.length - 1) emit('change', props.currentIndex + 1)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') onClose()
  if (e.key === 'ArrowLeft') onPrev()
  if (e.key === 'ArrowRight') onNext()
}

watch(
  () => props.visible,
  (open) => {
    if (import.meta.client) document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true },
)

onMounted(() => {
  if (import.meta.client) window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<style lang="scss" scoped>
.flash-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.flash-lightbox__close {
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
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.flash-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  &--prev {
    left: 1.5rem;
  }

  &--next {
    right: 1.5rem;
  }
}

.flash-lightbox__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 56rem;
  max-height: 90vh;
  width: 100%;
}

.flash-lightbox__img {
  display: block;
  max-width: 100%;
  max-height: 82vh;
  object-fit: contain;
  border-radius: $radius-md;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.flash-lightbox__counter {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}

.flash-lightbox-fade-enter-active {
  transition: opacity 0.25s ease;
}

.flash-lightbox-fade-leave-active {
  transition: opacity 0.2s ease;
}

.flash-lightbox-fade-enter-from,
.flash-lightbox-fade-leave-to {
  opacity: 0;
}
</style>
