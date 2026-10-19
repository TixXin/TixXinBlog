<!--
  @file CodeCopyButton.vue
  @description 代码块复制按钮：Lucide 图标、提示气泡与可访问名，复制成功切换图标并通过状态区播报；
               文章 Markdown 代码块与回退渲染的 CodeBlock 共用
-->
<template>
  <CommonTooltip :content="copied ? $t('article.codeCopy.copied') : $t('article.codeCopy.copy')" placement="top">
    <button
      type="button"
      class="code-copy"
      :class="{ 'is-copied': copied }"
      :aria-label="copied ? $t('article.codeCopy.copiedLabel') : $t('article.codeCopy.copy')"
      @click="copy"
    >
      <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="15" aria-hidden="true" />
      <span class="code-copy__text" aria-hidden="true">{{
        copied ? $t('article.codeCopy.copied') : $t('article.codeCopy.short')
      }}</span>
    </button>
  </CommonTooltip>
  <span class="sr-only" role="status">{{ copied ? $t('article.codeCopy.announced') : '' }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{ code: string }>()

const { t } = useI18n()
const copied = ref(false)
const { warning: notifyCopyFailure } = useToast()
let copyTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => {
  alive = false
  if (copyTimer) clearTimeout(copyTimer)
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    if (!alive) return
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    if (alive) notifyCopyFailure(t('article.codeCopy.failed'))
  }
}
</script>

<style lang="scss" scoped>
.code-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2rem;
  padding: 0.25rem 0.55rem;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  line-height: 1;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover,
  &:focus-visible {
    background: var(--surface-3, rgba(127, 127, 127, 0.14));
    color: var(--text-main);
    border-color: var(--border);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  &.is-copied {
    color: var(--success-text, #047857);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
