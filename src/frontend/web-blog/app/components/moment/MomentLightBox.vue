<!--
  @file MomentLightBox.vue
  @description 朋友圈多图轮播灯箱，支持左右切换与键盘导航
  @author TixXin
  @since 2026-04-10
-->

<template>
  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div
        v-if="visible && images.length > 0"
        class="moment-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onClose"
      >
        <!-- 关闭按钮 -->
        <button type="button" class="moment-lightbox__close" aria-label="关闭" @click="onClose">
          <Icon name="lucide:x" size="24" />
        </button>

        <!-- 左箭头 -->
        <button
          v-if="currentIndex > 0"
          type="button"
          class="moment-lightbox__nav moment-lightbox__nav--prev"
          aria-label="上一张"
          @click="onPrev"
        >
          <Icon name="lucide:chevron-left" size="28" />
        </button>

        <!-- 图片内容 -->
        <div class="moment-lightbox__content" @click.self="onClose">
          <img :src="images[currentIndex]" alt="预览图片" class="moment-lightbox__img" >
          <!-- 计数器 -->
          <div v-if="images.length > 1" class="moment-lightbox__counter">
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </div>

        <!-- 右箭头 -->
        <button
          v-if="currentIndex < images.length - 1"
          type="button"
          class="moment-lightbox__nav moment-lightbox__nav--next"
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
  if (props.currentIndex > 0) {
    emit('change', props.currentIndex - 1)
  }
}

function onNext() {
  if (props.currentIndex < props.images.length - 1) {
    emit('change', props.currentIndex + 1)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') onClose()
  if (e.key === 'ArrowLeft') onPrev()
  if (e.key === 'ArrowRight') onNext()
}

// 控制 body 滚动
watch(
  () => props.visible,
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
.moment-lightbox {
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

.moment-lightbox__close {
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

.moment-lightbox__nav {
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

.moment-lightbox__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 56rem;
  max-height: 90vh;
  width: 100%;
}

.moment-lightbox__img {
  display: block;
  max-width: 100%;
  max-height: 82vh;
  object-fit: contain;
  border-radius: $radius-md;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transition: opacity 0.2s ease;
}

.moment-lightbox__counter {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}

// 进出过渡
.lightbox-fade-enter-active {
  transition: opacity 0.25s ease;
}

.lightbox-fade-leave-active {
  transition: opacity 0.2s ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}
</style>
