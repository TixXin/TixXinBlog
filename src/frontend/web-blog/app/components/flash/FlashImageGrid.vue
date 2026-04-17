<!--
  @file FlashImageGrid.vue
  @description 闪念图片网格：1/2/3 列智能布局，点击单张打开 LightBox
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div v-if="images.length > 0" class="flash-grid" :class="gridClass">
    <div
      v-for="(img, idx) in images"
      :key="img + idx"
      class="flash-grid__cell"
      @click="open(idx)"
    >
      <img :src="img" alt="闪念配图" loading="lazy" class="flash-grid__img" >
    </div>

    <ClientOnly>
      <FlashImageLightBox
        :images="images"
        :current-index="currentIndex"
        :visible="lightBoxVisible"
        @close="lightBoxVisible = false"
        @change="currentIndex = $event"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  images: string[]
}>()

const lightBoxVisible = ref(false)
const currentIndex = ref(0)

const gridClass = computed(() => {
  const len = props.images.length
  if (len === 1) return 'flash-grid--1'
  if (len === 2 || len === 4) return 'flash-grid--2'
  return 'flash-grid--3'
})

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
  aspect-ratio: 1;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-2);
  cursor: zoom-in;
}

.flash-grid__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;

  .flash-grid__cell:hover & {
    transform: scale(1.04);
  }
}
</style>
