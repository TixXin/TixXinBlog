<!--
  @file DefaultPostCard.vue
  @description 宿主默认文章卡片：主题未提供 PostCard 时使用，避免跨主题回退到 aurora 的组件
  @author TixXin
  @since 2026-10-22
-->

<template>
  <SharedPostCard v-bind="$attrs" :post="post" :priority="priority" />
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'
import SharedPostCard from '~/components/blog/PostCard.vue'

defineOptions({ inheritAttrs: false })
defineProps<{
  post: PostItem
  priority?: boolean
}>()
</script>
