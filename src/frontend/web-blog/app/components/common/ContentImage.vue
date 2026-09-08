<!--
  @file ContentImage.vue
  @description 受管图片已由服务器优化，直接加载资源接口；其他图片保持 Nuxt Image 行为。
-->
<template>
  <img v-if="managed" v-bind="$attrs" :src="src" :alt="alt" /><NuxtImg v-else v-bind="$attrs" :src="src" :alt="alt" />
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ src?: string; alt?: string }>(), { src: '', alt: '' })
const managed = computed(() => props.src.includes('/api/v1/media/'))
</script>
