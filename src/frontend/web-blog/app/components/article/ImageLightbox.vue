<!--
  @file ImageLightbox.vue
  @description 文章正文图片灯箱：模态对话框、焦点约束与归还、Esc 关闭，显示替代文本说明，
               左右方向键或按钮在同一篇文章的图片间切换；不复用图库/朋友圈灯箱，避免耦合其业务字段
-->
<template>
  <Teleport to="body">
    <div
      v-if="image"
      ref="dialogRef"
      class="article-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogLabel"
      :aria-describedby="captionId"
      tabindex="-1"
      @click.self="emit('close')"
      @keydown.left.prevent="go(-1)"
      @keydown.right.prevent="go(1)"
    >
      <button
        ref="closeRef"
        type="button"
        class="article-lightbox__close"
        :aria-label="$t('article.lightbox.close')"
        @click="emit('close')"
      >
        <Icon name="lucide:x" size="22" aria-hidden="true" />
      </button>
      <figure class="article-lightbox__figure" @click.self="emit('close')">
        <CommonImageFrame
          :key="image.src"
          class="article-lightbox__image"
          :src="image.src"
          :alt="image.alt"
          loading="eager"
          fit="contain"
          max-height="calc(100dvh - 11rem)"
        />
        <figcaption :id="captionId" class="article-lightbox__caption" aria-live="polite">
          <span v-if="image.alt">{{ image.alt }}</span>
          <span v-else class="article-lightbox__muted">{{ $t('article.lightbox.noAlt') }}</span>
          <span v-if="images.length > 1" class="article-lightbox__count">{{ index + 1 }} / {{ images.length }}</span>
        </figcaption>
      </figure>
      <nav v-if="images.length > 1" class="article-lightbox__nav" :aria-label="$t('article.lightbox.nav')">
        <button type="button" :disabled="index <= 0" :aria-label="$t('article.lightbox.previous')" @click="go(-1)">
          <Icon name="lucide:chevron-left" size="20" aria-hidden="true" /><span>{{
            $t('article.lightbox.previous')
          }}</span>
        </button>
        <button
          type="button"
          :disabled="index >= images.length - 1"
          :aria-label="$t('article.lightbox.next')"
          @click="go(1)"
        >
          <span>{{ $t('article.lightbox.next') }}</span
          ><Icon name="lucide:chevron-right" size="20" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export interface ArticleLightboxImage {
  src: string
  alt: string
}

const props = defineProps<{ images: ArticleLightboxImage[]; index: number }>()
const emit = defineEmits<{ close: []; 'update:index': [value: number] }>()

const image = computed(() => props.images[props.index] ?? null)
const captionId = useId()
const { t } = useI18n()
const dialogLabel = computed(() =>
  props.images.length > 1
    ? t('article.lightbox.dialogPosition', { index: props.index + 1, total: props.images.length })
    : t('article.lightbox.dialog'),
)

function go(step: number) {
  const next = props.index + step
  if (next >= 0 && next < props.images.length) emit('update:index', next)
}

const dialogRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLElement | null>(null)
useModalFocus(() => !!image.value, dialogRef, {
  close: () => emit('close'),
  initialFocus: () => closeRef.value,
})
</script>

<style lang="scss" scoped>
.article-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3.5rem 1rem 1rem;
  background: rgba(0, 0, 0, 0.88);
  color: #fff;
  overscroll-behavior: contain;
  animation: article-lightbox-in 0.18s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes article-lightbox-in {
  from {
    opacity: 0;
  }
}

.article-lightbox__figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: min(72rem, 100%);
  max-width: min(72rem, 100%);
  margin: 0;
  min-height: 0;
}

.article-lightbox__image {
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - 11rem);
  object-fit: contain;
  border-radius: $radius-md;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  background: rgba(255, 255, 255, 0.04);
}

.article-lightbox__caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.75rem;
  max-width: 48rem;
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}

.article-lightbox__muted,
.article-lightbox__count {
  color: rgba(255, 255, 255, 0.72);
}

.article-lightbox__count {
  font-variant-numeric: tabular-nums;
}

.article-lightbox button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 44px;
  min-height: 44px;
  padding: 0.5rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font: inherit;
  cursor: var(--interaction-cursor, pointer);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.article-lightbox__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border-radius: $radius-full !important;
  padding: 0 !important;
}

.article-lightbox__nav {
  display: flex;
  gap: 0.75rem;
}
</style>
