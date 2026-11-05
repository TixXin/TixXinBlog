<!-- @file AboutItemTitle.vue @description 关于页条目标题：有链接时渲染为新窗口外链并附读屏说明，否则为纯文本 -->
<template>
  <a v-if="item.url" :href="item.url" class="about-item-title" target="_blank" rel="noopener"
    >{{ item.title
    }}<Icon name="lucide:external-link" size="12" class="about-item-title__icon" aria-hidden="true" /><span
      class="sr-only"
      >{{ $t('article.markdown.newWindow') }}</span
    ></a
  >
  <span v-else>{{ item.title }}</span>
</template>
<script setup lang="ts">
import type { AboutItem } from '~/features/about/types'
defineProps<{ item: AboutItem }>()
</script>
<style scoped lang="scss">
.about-item-title {
  color: inherit;
  text-decoration: none;
  &:hover,
  &:focus-visible {
    color: var(--accent-action);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
}
.about-item-title__icon {
  margin-left: 0.25rem;
  vertical-align: -0.05em;
  opacity: 0.6;
}
</style>
