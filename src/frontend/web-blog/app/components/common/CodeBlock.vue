<!--
  @file CodeBlock.vue
  @description 代码块高亮组件（结构化回退正文使用），与文章 Markdown 共用精简 Shiki 高亮器；
               亮暗双主题以 CSS 变量输出、随 html.dark 切换，标题栏显示语言标签与复制按钮
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="article-content__code-wrap">
    <div class="article-content__code-header">
      <span class="article-content__code-lang">{{ label }}</span>
      <ArticleCodeCopyButton :code="code" />
    </div>
    <!-- 只有 Shiki 生成的受控 HTML 进入 v-html；失败或未知语言时以 Vue 文本节点输出。 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="highlightedHtml" class="article-content__pre" v-html="highlightedHtml" />
    <div v-else class="article-content__pre">
      <pre tabindex="0"><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { codeLanguageLabel, highlightCode } from '~/utils/highlightCode'

const props = defineProps<{
  code: string
  language?: string
}>()

const { t } = useI18n()
const label = computed(() => codeLanguageLabel(props.language, t) || t('layout.codeBlock.fallbackLabel'))

// 每个代码块独立缓存，避免相同前缀的不同正文共享结果；props 变化时重新高亮。
const { data: highlightedHtml } = await useAsyncData(
  `shiki-${useId()}`,
  () => highlightCode(props.code, props.language),
  { watch: [() => props.code, () => props.language] },
)
</script>

<style lang="scss" scoped>
.article-content__code-wrap {
  max-width: 100%;
  margin: 0 0 1.5rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
}

.article-content__code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  border-bottom: 1px solid var(--border);
}

.article-content__code-lang {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.article-content__pre {
  font-size: 0.8125rem;
  line-height: 1.65;
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;

  :deep(pre) {
    margin: 0;
    padding: 1.25rem;
    overflow-x: auto;
    background: transparent;
    tab-size: 2;
  }

  :deep(pre:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  :deep(code) {
    font-family: inherit;
    white-space: pre;
  }

  :deep(.shiki),
  :deep(.shiki span) {
    color: var(--shiki-light);
    font-style: var(--shiki-light-font-style);
    font-weight: var(--shiki-light-font-weight);
    text-decoration: var(--shiki-light-text-decoration);
  }
}

/* 亮暗双主题：切换只改变量选择，不重新高亮 */
:is(html.dark) .article-content__pre :deep(.shiki),
:is(html.dark) .article-content__pre :deep(.shiki span) {
  color: var(--shiki-dark);
  font-style: var(--shiki-dark-font-style);
  font-weight: var(--shiki-dark-font-weight);
  text-decoration: var(--shiki-dark-text-decoration);
}
</style>
