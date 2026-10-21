<!--
  @file MomentCardImages.vue
  @description 朋友圈动态卡片多图网格展示、失败容错与灯箱预览
  @author TixXin
  @since 2026-04-20
-->

<template>
  <div v-if="images && images.length > 0" class="moment-card__images" :class="gridClass">
    <div v-for="(img, idx) in images" :key="img + idx" class="moment-card__image-wrap">
      <CommonImageFrame
        :alt="imageAlts?.[idx] || $t('flash-moment.momentCard.imageAlt', { index: idx + 1 })"
        class="moment-card__image"
        loading="lazy"
        :sizes="imageSizes"
        :src="img"
        @state="updateImageFailure(img + idx, $event)"
      />
      <button
        v-if="img && !imageFailures[img + idx]"
        type="button"
        class="moment-card__image-preview"
        :aria-label="$t('flash-moment.momentCard.viewImage', { index: idx + 1 })"
        @click="openLightBox(idx)"
      />
    </div>
  </div>

  <!-- 多图灯箱 -->
  <ClientOnly>
    <MomentLightBox
      :images="images ?? []"
      :current-index="lightBoxIndex"
      :visible="lightBoxVisible"
      @close="closeLightBox"
      @change="onLightBoxChange"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    images?: string[]
    imageAlts?: string[]
  }>(),
  {
    images: () => [],
    imageAlts: () => [],
  },
)

const gridClass = computed(() => {
  const size = props.images?.length || 0
  return size === 1 ? 'grid-1' : size === 2 || size === 4 ? 'grid-2' : 'grid-3'
})

// 预览入口与失败重试保持同级，避免按钮嵌套或重试误开灯箱。
const imageFailures = ref<Record<string, boolean>>({})
function updateImageFailure(key: string, state: 'loading' | 'ready' | 'error' | 'empty') {
  // 重试期间仍显示反馈按钮，成功前不重新覆盖预览入口。
  if (state !== 'loading') imageFailures.value[key] = state === 'error'
}

// 受管图片按网格单元实际宽度取变体：单图最宽 240px，网格容器最宽 400px 分两列或三列；
// 窄屏网格随卡片收窄（390px 视口实测两列约 129px、三列约 84px）
const imageSizes = computed(
  () =>
    ({
      'grid-1': '240px',
      'grid-2': '(max-width: 480px) 34vw, 200px',
      'grid-3': '(max-width: 480px) 22vw, 135px',
    })[gridClass.value],
)

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
  position: relative;
  aspect-ratio: 1;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-2);
}

.moment-card__image {
  width: 100%;
  height: 100%;
  max-height: 300px;
}

.moment-card__image :deep(.image-frame__image) {
  transition: transform 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .moment-card__image-wrap:hover & {
    transform: scale(1.05);
  }
}

.moment-card__image-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: var(--interaction-cursor, zoom-in);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }
}
</style>
