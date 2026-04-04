<!--
  @file CodeBlock.vue
  @description 代码块高亮组件，基于 Shiki，支持亮暗双色主题
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="article-content__code-wrap">
    <CommonTooltip :content="copied ? '已复制' : '复制代码'" placement="top">
      <button
        type="button"
        class="article-content__copy"
        :class="{ 'is-copied': copied }"
        aria-label="复制代码"
        @click="copyCode(code)"
      >
        <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="16" />
      </button>
    </CommonTooltip>
    <div class="article-content__pre" v-html="highlightedHtml || fallbackHtml" />
  </div>
</template>

<script setup lang="ts">
import { codeToHtml } from 'shiki'

const props = defineProps<{
  code: string
  language?: string
}>()

const fallbackHtml = computed(() => `<pre><code>${props.code}</code></pre>`)

const { data: highlightedHtml } = await useAsyncData(`shiki-${props.code.slice(0, 20)}-${props.language}`, async () => {
  try {
    return await codeToHtml(props.code, {
      lang: props.language || 'text',
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    })
  } catch (e) {
    console.error('Shiki highlight error:', e)
    return fallbackHtml.value
  }
})

const copied = ref(false)

async function copyCode(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    /* 剪贴板不可用时不打断阅读 */
  }
}
</script>

<style lang="scss" scoped>
.article-content__code-wrap {
  position: relative;
  margin: 0 0 1.5rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;

  :global(.dark) & {
    background: #0d1117;
    border-color: rgba(51, 65, 85, 0.5);
  }
}

.article-content__copy {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  padding: 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-faint);
  cursor: pointer;
  opacity: 0;
  transition: $transition-fast;

  .article-content__code-wrap:hover &,
  &:focus-visible {
    opacity: 1;
  }

  &:hover,
  &.is-copied {
    background: rgba(255, 255, 255, 0.18);
    color: var(--text-main);
  }

  &.is-copied {
    color: #10b981;
  }
}

.article-content__pre {
  margin: 0;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.65;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  :deep(pre) {
    margin: 0;
    padding: 1.25rem;
    background-color: transparent !important;
  }
}

/* Shiki dual themes CSS */
:global(.dark) .article-content__pre :deep(.shiki),
:global(.dark) .article-content__pre :deep(.shiki span) {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
</style>
