<!--
  @file ContentImage.vue
  @description 受管图片直接加载资源接口；调用方给出 sizes 时输出白名单宽度的 srcset，由服务器按宽度生成 WebP 变体。
  其他图片保持 Nuxt Image 行为。priority 用于首屏关键图：立即加载并提高抓取优先级。
-->
<template>
  <img
    v-if="managed"
    v-bind="nativeAttrs"
    :loading="loading"
    :fetchpriority="priority ? 'high' : undefined"
    :srcset="srcset"
    :src="src"
    :alt="alt"
  /><NuxtImg
    v-else
    v-bind="$attrs"
    :loading="loading"
    :fetchpriority="priority ? 'high' : undefined"
    :src="src"
    :alt="alt"
  />
</template>
<script setup lang="ts">
import { managedImageSrcset } from '~/utils/managedImage'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ src?: string; alt?: string; priority?: boolean }>(), {
  src: '',
  alt: '',
  priority: false,
})
const attrs = useAttrs()
// 首屏关键图强制立即加载，其余沿用调用方的 loading
const loading = computed(() => (props.priority ? 'eager' : (attrs.loading as 'eager' | 'lazy' | undefined)))
// IPX 只读取 public 目录，相对的受管媒体地址交给它会 404，必须绕过
const managed = computed(() => props.src.includes('/api/v1/media/'))
// 受管媒体按显示宽度挑选服务端变体：调用方用 sizes 描述实际显示宽度才启用，
// 未声明的旧调用处保持原图，避免宽度描述符改变无 CSS 尺寸图片的固有大小
const srcset = computed(() => (attrs.sizes ? managedImageSrcset(props.src) : undefined))
// 仅 Nuxt Image 识别的转换参数，直出原生 img 时剔除，避免落成无意义的 DOM 属性
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
</script>
