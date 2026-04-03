<!--
  @file PostCard.vue
  @description 单栏极简主题的文章卡片（桥接共享组件）
  @author TixXin
  @since 2026-04-03
-->

<template>
  <SharedPostCard v-bind="$attrs" />
</template>

<script setup lang="ts">
import SharedPostCard from '../../../../app/components/blog/PostCard.vue'

defineOptions({ inheritAttrs: false })
</script>
