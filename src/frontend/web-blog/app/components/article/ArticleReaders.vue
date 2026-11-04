<!--
  @file ArticleReaders.vue
  @description 文章页“N 人正在阅读”：来自实时在线心跳，只在结果属于当前页面且不止自己一人时显示；
    SSR 与水合首帧没有心跳结果，不渲染，静态发布不启动心跳因而始终隐藏。
-->

<template>
  <span v-if="readers !== null" class="article-readers" :title="$t('article.detail.readersLabel')">
    <span class="article-readers__dot" aria-hidden="true" />
    {{ $t('article.detail.readers', { count: formatNumber(readers) }) }}
  </span>
</template>

<script setup lang="ts">
import { useLivePresenceState } from '~/composables/useLivePresence'
import { readersOnPage } from '~/features/presence/readers'
import { formatNumber } from '~/utils/format'

const live = useLivePresenceState()
const route = useRoute()
const readers = computed(() => readersOnPage(live.value, route.path))
</script>

<style lang="scss" scoped>
.article-readers {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.article-readers__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--stat-green-dot);
  box-shadow: 0 0 0 2px var(--stat-green-bg);
}
</style>
