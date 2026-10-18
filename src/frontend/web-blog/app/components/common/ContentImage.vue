<!--
  @file ContentImage.vue
  @description 受管图片直出响应式变体，其他图片保留 Nuxt Image；失败时保留图片盒尺寸并提供键盘重试。
-->
<template>
  <span
    v-if="state === 'error'"
    v-bind="fallbackAttrs"
    class="content-image-failure"
    :style="[attrs.style, reservedStyle]"
  >
    <CommonImageFailure ref="failure" :alt="alt" :compact="props.compact || measuredCompact" @retry="retryImage" />
  </span>
  <img
    v-else-if="native || managed"
    :key="attempt"
    ref="imageNode"
    v-bind="nativeAttrs"
    :style="[attrs.style, pendingStyle]"
    :loading="loading"
    :fetchpriority="priority ? 'high' : undefined"
    :srcset="srcset"
    :src="src"
    :alt="alt"
    @load="onLoad"
    @error="onError"
  />
  <NuxtImg
    v-else
    :key="attempt"
    ref="imageNode"
    v-bind="$attrs"
    :style="[attrs.style, pendingStyle]"
    :loading="loading"
    :fetchpriority="priority ? 'high' : undefined"
    :src="src"
    :alt="alt"
    @load="onLoad"
    @error="onError"
  />
</template>
<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import { managedImageSrcset } from '~/utils/managedImage'

defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{ src?: string; alt?: string; priority?: boolean; native?: boolean; compact?: boolean }>(),
  {
    src: '',
    alt: '',
    priority: false,
    native: false,
    compact: false,
  },
)
const emit = defineEmits<{
  load: [event: Event]
  error: [event: Event]
  state: [value: 'loading' | 'ready' | 'error' | 'empty']
}>()
const attrs = useAttrs()
const { image, state, attempt, loaded, failed, retry } = useImageState(() => props.src)
const imageNode = shallowRef<HTMLImageElement | ComponentPublicInstance | null>(null)
const failure = shallowRef<ComponentPublicInstance | null>(null)
const reservedStyle = ref<CSSProperties>({})
const measuredCompact = ref(false)
const hasRetried = ref(false)
let restoreFocus = false
// 保留成功路径的原生图片根节点和调用方样式；NuxtImg 的组件实例桥接到真实 img。
watch(
  imageNode,
  (node, _previous, onCleanup) => {
    const element = node instanceof HTMLImageElement ? node : node?.$el instanceof HTMLImageElement ? node.$el : null
    image.value = element
    if (!element) return
    if (state.value !== 'error') rememberSize(false)
    const observer = new ResizeObserver(() => {
      if (state.value !== 'error' && image.value === element) rememberSize(false)
    })
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  },
  { flush: 'post' },
)
function rememberSize(allowFallback = true) {
  const node = image.value
  if (!node) return
  const rect = node.getBoundingClientRect()
  if (!allowFallback && !(node.offsetWidth || rect.width) && !(node.offsetHeight || rect.height)) return
  const width = node.offsetWidth || rect.width || Number(attrs.width) || 240
  const height = node.offsetHeight || rect.height || Number(attrs.height) || width / 1.5
  reservedStyle.value = { width: `${width}px`, height: `${height}px`, maxWidth: '100%', boxSizing: 'border-box' }
  measuredCompact.value = width < 80 || height < 70
}
function onLoad(event: Event) {
  if (event.target !== image.value) return
  rememberSize()
  void loaded(event)
  emit('load', event)
}
function onError(event: Event | string) {
  if (typeof event !== 'string' && event.target !== image.value) return
  if (!reservedStyle.value.width) rememberSize()
  failed(typeof event === 'string' ? undefined : event)
  emit('error', typeof event === 'string' ? new Event('error') : event)
}
watch(
  state,
  (value) => {
    if (value === 'error' && !reservedStyle.value.width) rememberSize()
    emit('state', value)
  },
  { immediate: true, flush: 'sync' },
)
watch(
  state,
  async (value) => {
    if (!restoreFocus) return
    const source = props.src
    await nextTick()
    if (!restoreFocus || props.src !== source || state.value !== value) return
    const target = value === 'error' ? failure.value?.$el?.querySelector('button') : image.value
    if (!(target instanceof HTMLElement)) return
    // 用户已经移走焦点时不抢回；被替换的原控件会让浏览器暂时聚焦 body。
    if (document.activeElement !== document.body && document.activeElement !== image.value) {
      restoreFocus = false
      return
    }
    if (target instanceof HTMLImageElement) target.tabIndex = -1
    target.focus({ preventScroll: true })
    if (value === 'ready' || value === 'error') restoreFocus = false
  },
  { flush: 'post' },
)
watch(
  () => props.src,
  () => {
    reservedStyle.value = {}
    hasRetried.value = false
    restoreFocus = false
  },
  { flush: 'sync' },
)
function retryImage() {
  restoreFocus = true
  hasRetried.value = true
  retry()
}
const pendingStyle = computed(() => {
  if (state.value !== 'loading') return undefined
  if (hasRetried.value) return reservedStyle.value
  // 正文原生图片没有尺寸时，从请求开始预留后备盒；成功后恢复固有尺寸。
  if (props.native && !attrs.width && !attrs.height) {
    return { width: '240px', maxWidth: '100%', height: 'auto', aspectRatio: '3 / 2' }
  }
  return undefined
})
// 手动重试立即请求，不能再次等待懒加载观察器。
const loading = computed(() =>
  props.priority || hasRetried.value ? 'eager' : (attrs.loading as 'eager' | 'lazy' | undefined),
)
// IPX 只读取 public 目录，相对的受管媒体地址必须绕过。
const managed = computed(() => props.src.includes('/api/v1/media/'))
const srcset = computed(() =>
  props.native && attrs.srcset ? String(attrs.srcset) : attrs.sizes ? managedImageSrcset(props.src) : undefined,
)
const NUXT_IMG_ONLY = new Set([
  'format',
  'quality',
  'fit',
  'modifiers',
  'preset',
  'provider',
  'densities',
  'placeholder',
])
const nativeAttrs = computed<Record<string, unknown>>(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => !NUXT_IMG_ONLY.has(key))),
)
// 错误占位只继承布局与描述，不把图片转换参数或预览点击监听带到重试区域。
const fallbackAttrs = computed(() => ({ class: attrs.class, id: typeof attrs.id === 'string' ? attrs.id : undefined }))
</script>
<style lang="scss" scoped>
.content-image-failure {
  position: relative;
  display: inline-block;
  vertical-align: middle;
  overflow: hidden;
  border-radius: inherit;
}
</style>
