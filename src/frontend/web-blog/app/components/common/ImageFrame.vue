<!--
  @file ImageFrame.vue
  @description 保留图片比例的加载容器：慢图和破图保持占位，提供可键盘操作的重试；
  受管媒体输出白名单宽度的 srcset，priority 用于首屏关键图
  @author TixXin
  @since 2026-09-07
-->
<template>
  <div
    class="image-frame"
    :class="`image-frame--${state}`"
    :data-initial="initial || undefined"
    :aria-busy="state === 'loading'"
    :style="frameStyle"
  >
    <img
      v-if="src"
      :key="attempt"
      ref="image"
      class="image-frame__image"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : loading"
      :fetchpriority="priority ? 'high' : undefined"
      :sizes="srcset ? (sizes ?? '100vw') : undefined"
      :srcset="srcset"
      :src="src"
      referrerpolicy="no-referrer"
      @load="loaded"
      @error="failed"
    />
    <span v-if="state === 'loading'" class="image-frame__status" aria-hidden="true">图片加载中…</span>
    <div v-else-if="state === 'error' || state === 'empty'" class="image-frame__status">
      <Icon name="lucide:image-off" size="22" aria-hidden="true" />
      <span>{{ state === 'empty' ? '暂无图片' : '图片暂时无法加载' }}</span>
      <button v-if="src" type="button" :aria-label="`重新加载图片：${alt}`" @click.stop.prevent="retry" @keydown.stop>
        重新加载
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { managedImageSrcset } from '~/utils/managedImage'

const props = withDefaults(
  defineProps<{
    src?: string
    alt: string
    width?: number
    height?: number
    fit?: 'cover' | 'contain'
    loading?: 'eager' | 'lazy'
    /** 首屏关键图：立即加载并提高抓取优先级，覆盖 loading */
    priority?: boolean
    /** 实际显示宽度描述，仅受管媒体生效；已知原图宽度但未传时按视口宽度 */
    sizes?: string
    maxHeight?: string
  }>(),
  {
    src: '',
    fit: 'cover',
    loading: 'lazy',
    priority: false,
    sizes: undefined,
    maxHeight: undefined,
    width: undefined,
    height: undefined,
  },
)
// 已知原图宽度时只列出更小的变体并补上原图；原图宽度和 sizes 都未知（如闪念灯箱）时保持原图，
// 避免全屏查看被限制在最大变体宽度。外链图片不生成 srcset
const srcset = computed(() => (props.width || props.sizes ? managedImageSrcset(props.src, props.width) : undefined))
const { image, state, attempt, loaded, failed, retry } = useImageState(() => props.src)
// 首屏 SSR 直出的图片由浏览器原生渐进显示，就绪后不能再把仍在加载的它藏起来；切页后新建的图片才走加载反馈
const initial = import.meta.server || useNuxtApp().isHydrating
const emit = defineEmits<{ state: [value: 'loading' | 'ready' | 'error' | 'empty'] }>()
watch(state, (value) => emit('state', value), { immediate: true })
const naturalRatio = computed(() =>
  state.value === 'ready' && image.value?.naturalWidth && image.value.naturalHeight
    ? `${image.value.naturalWidth} / ${image.value.naturalHeight}`
    : '3 / 2',
)
const frameStyle = computed(() => ({
  aspectRatio: props.width && props.height ? `${props.width} / ${props.height}` : naturalRatio.value,
  maxHeight: props.maxHeight,
  '--image-fit': props.fit === 'contain' ? 'scale-down' : props.fit,
}))
</script>
<style lang="scss" scoped>
.image-frame {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--surface-2);
  border-radius: inherit;
  &--ready {
    background: transparent;
  }
}
.image-frame__image {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: var(--image-fit);
  opacity: 1;
  html.app-client-ready .image-frame--loading:not([data-initial]) &,
  html.app-client-ready .image-frame--error & {
    opacity: 0;
  }
}
.image-frame__status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  padding: 0.75rem;
  button {
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    color: var(--accent-text);
    border: 1px solid var(--border);
    border-radius: $radius-sm;
    background: var(--surface-1);
  }
}

// 未启动JavaScript时保留原生图片；启动后的异步图片才显示交互加载反馈。
html:not(.app-client-ready) .image-frame__status {
  display: none;
}
</style>
