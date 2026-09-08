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
    <!-- 只有 Shiki 生成的受控 HTML 进入 v-html；失败时以 Vue 文本节点输出。 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="highlightedHtml" class="article-content__pre" v-html="highlightedHtml" />
    <div v-else class="article-content__pre">
      <pre><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { highlightCode } from '~/utils/highlightCode'

const props = defineProps<{
  code: string
  language?: string
}>()

// 每个代码块独立缓存，避免相同前缀的不同正文共享结果；props 变化时重新高亮。
const { data: highlightedHtml } = await useAsyncData(
  `shiki-${useId()}`,
  () => highlightCode(props.code, props.language),
  { watch: [() => props.code, () => props.language] },
)

const copied = ref(false)
const { warning: notifyCopyFailure } = useToast()
let copyTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => {
  alive = false
  if (copyTimer) clearTimeout(copyTimer)
})

async function copyCode(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    if (!alive) return
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    if (alive) notifyCopyFailure('复制失败，请手动选择代码复制。')
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

  :is(html.dark) & {
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
:is(html.dark) .article-content__pre :deep(.shiki),
:is(html.dark) .article-content__pre :deep(.shiki span) {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
</style>
