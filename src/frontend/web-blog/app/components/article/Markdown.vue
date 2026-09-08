<!--
  @file Markdown.vue
  @description 管理后台编辑和前台文章共用的安全 Markdown 预览
-->
<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <article class="article-markdown" v-html="html" />
</template>

<script setup lang="ts">
import { renderArticleMarkdown } from '~/utils/articleMarkdown'
const props = defineProps<{ content: string }>()
const html = computed(() => renderArticleMarkdown(props.content))
</script>

<style scoped lang="scss">
.article-markdown {
  color: var(--text-main);
  line-height: 1.8;
  overflow-wrap: anywhere;
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 1.5rem 0 0.75rem;
    scroll-margin-top: 5rem;
  }
  :deep(h1) {
    font-size: 1.6rem;
  }
  :deep(h2) {
    font-size: 1.3rem;
  }
  :deep(h3) {
    font-size: 1.1rem;
  }
  :deep(p),
  :deep(ul),
  :deep(ol) {
    margin: 0 0 1rem;
  }
  :deep(ul),
  :deep(ol) {
    padding-left: 1.5rem;
  }
  :deep(pre) {
    overflow-x: auto;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface-2);
    margin-bottom: 1rem;
  }
  :deep(code) {
    font-size: 0.875em;
  }
  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
  }
  :deep(a) {
    color: var(--accent-text);
    text-decoration: underline;
  }
  :deep(blockquote) {
    border-left: 3px solid var(--accent);
    padding-left: 1rem;
    color: var(--text-muted);
  }
  :deep(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
  }
  :deep(td),
  :deep(th) {
    padding: 0.5rem;
    border: 1px solid var(--border);
  }
}
</style>
