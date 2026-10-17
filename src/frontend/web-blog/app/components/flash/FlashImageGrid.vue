<!--
  @file FlashImageGrid.vue
  @description 闪念图片网格：1/2/3 列智能布局，点击单张打开 LightBox
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div v-if="images.length > 0" class="flash-grid" :class="gridClass">
    <button
      v-for="(img, idx) in images"
      :key="img + idx"
      type="button"
      :aria-label="`预览图片：${descriptions[idx] || idx + 1}`"
      class="flash-grid__cell"
      @click="open(idx)"
    >
      <img
        :alt="descriptions?.[idx] || '闪念配图'"
        loading="lazy"
        class="flash-grid__img"
        :sizes="imageSizes"
        :srcset="managedImageSrcset(img)"
        :src="img"
      />
    </button>

    <ClientOnly>
      <FlashImageLightBox
        :images="images"
        :descriptions="descriptions"
        :current-index="currentIndex"
        :visible="lightBoxVisible"
        @close="lightBoxVisible = false"
        @change="currentIndex = $event"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { managedImageSrcset } from '~/utils/managedImage'

const props = withDefaults(
  defineProps<{
    images: string[]
    descriptions?: string[]
  }>(),
  { descriptions: () => [] },
)

const lightBoxVisible = ref(false)
const currentIndex = ref(0)

const gridClass = computed(() => {
  const len = props.images.length
  if (len === 1) return 'flash-grid--1'
  if (len === 2 || len === 4) return 'flash-grid--2'
  return 'flash-grid--3'
})

// 受管图片按网格单元实际宽度取变体：单图最宽 240px，网格容器最宽 380px 分两列或三列；窄屏随卡片收窄
const imageSizes = computed(
  () =>
    ({
      'flash-grid--1': '240px',
      'flash-grid--2': '(max-width: 480px) 40vw, 190px',
      'flash-grid--3': '(max-width: 480px) 26vw, 130px',
    })[gridClass.value],
)

function open(idx: number) {
  currentIndex.value = idx
  lightBoxVisible.value = true
}
</script>

<style lang="scss" scoped>
.flash-grid {
  display: grid;
  gap: 0.375rem;
  margin: 0.5rem 0 0.6rem;
  max-width: 380px;

  &--1 {
    grid-template-columns: 1fr;

    .flash-grid__cell {
      aspect-ratio: auto;
      max-width: 240px;
      max-height: 280px;
    }
  }

  &--2 {
    grid-template-columns: repeat(2, 1fr);
  }

  &--3 {
    grid-template-columns: repeat(3, 1fr);
  }
}
.flash-grid__cell {
  border: 0;
  padding: 0;
}

.flash-grid__cell {
  aspect-ratio: 1;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-2);
  cursor: var(--interaction-cursor, zoom-in);
}

.flash-grid__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .flash-grid__cell:hover & {
    transform: scale(1.04);
  }
}
</style>
