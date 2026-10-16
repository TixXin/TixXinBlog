<!--
  @file ContentImage.vue
  @description 受管图片已由服务器优化，直接加载资源接口；其他图片保持 Nuxt Image 行为。
-->
<template>
  <img v-if="managed" v-bind="nativeAttrs" :src="src" :alt="alt" /><NuxtImg
    v-else
    v-bind="$attrs"
    :src="src"
    :alt="alt"
  />
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ src?: string; alt?: string }>(), { src: '', alt: '' })
const attrs = useAttrs()
// IPX 只读取 public 目录，相对的受管媒体地址交给它会 404，必须绕过
const managed = computed(() => props.src.includes('/api/v1/media/'))
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
const nativeAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => !NUXT_IMG_ONLY.has(key))))
</script>
