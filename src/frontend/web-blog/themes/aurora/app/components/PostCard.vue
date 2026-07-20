<!--
  @file PostCard.vue
  @description 双栏文档主题的文章卡片（桥接共享组件）
  @author TixXin
  @since 2026-04-03
-->

<template>
  <SharedPostCard v-bind="$attrs" :post="post" />
</template>

<script setup lang="ts">
import SharedPostCard from '../../../../app/components/blog/PostCard.vue'
import type { PostItem } from '~/features/post/types'

defineOptions({ inheritAttrs: false })
defineProps<{ post: PostItem }>()
</script>
