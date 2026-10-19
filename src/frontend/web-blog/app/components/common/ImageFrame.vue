<!--
  @file ImageFrame.vue
  @description 保留图片比例的加载容器：慢图和破图保持占位，提供可键盘操作的重试；
  受管媒体输出白名单宽度的 srcset，priority 用于首屏关键图
  @author TixXin
  @since 2026-09-07
-->
<template>
  <div
    ref="frame"
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
    <CommonImageFailure
      v-if="failureVisible"
      :alt="alt"
      :retry-label="$t('layout.image.reload', { name: alt })"
      :compact="compact"
      :retrying="state === 'loading'"
      @retry="retryImage"
    />
    <span v-else-if="state === 'loading'" class="image-frame__status" aria-hidden="true">{{
      $t('layout.image.loading')
    }}</span>
    <div v-else-if="state === 'empty'" class="image-frame__status">
      <Icon name="lucide:image-off" size="22" aria-hidden="true" />
      <span>{{ $t('layout.image.empty') }}</span>
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
    /** 小型封面只显示失败图标按钮，完整说明由 Tooltip 和读屏标签提供 */
    compact?: boolean
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
    compact: false,
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
const naturalRatio = ref('3 / 2')
const failureVisible = ref(false)
const frame = ref<HTMLElement | null>(null)
let restoreFocus = false
function retryImage() {
  restoreFocus = !!frame.value?.contains(document.activeElement)
  retry()
}
watch(state, (value) => {
  if (value === 'error') failureVisible.value = true
  if (value === 'ready' || value === 'empty') failureVisible.value = false
  if (value === 'ready' && image.value?.naturalWidth && image.value.naturalHeight) {
    naturalRatio.value = `${image.value.naturalWidth} / ${image.value.naturalHeight}`
  }
  if (value === 'ready' && restoreFocus) {
    const source = props.src
    const focused = frame.value?.contains(document.activeElement)
    restoreFocus = false
    void nextTick(() => {
      if (!focused || source !== props.src || state.value !== 'ready' || document.activeElement !== document.body)
        return
      if (!image.value) return
      // 成功后保留键盘位置，但不为普通图片额外增加 Tab 停靠点。
      image.value.tabIndex = -1
      image.value.focus({ preventScroll: true })
    })
  }
})
watch(
  () => props.src,
  () => {
    naturalRatio.value = '3 / 2'
    failureVisible.value = false
    restoreFocus = false
  },
  { flush: 'sync' },
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
}

// 未启动JavaScript时保留原生图片；启动后的异步图片才显示交互加载反馈。
html:not(.app-client-ready) .image-frame__status {
  display: none;
}
</style>
