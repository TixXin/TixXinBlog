<!--
  @file HeadingAnchorButton.vue
  @description 正文标题锚点复制：原生按钮支持键盘操作，复用 Tooltip 与可播报 Toast，卸载时清理异步状态
-->
<template>
  <CommonTooltip :content="actionLabel" placement="top">
    <button
      type="button"
      class="heading-anchor"
      :class="{ 'is-copied': copied }"
      :aria-label="$t('article.headingAnchor.label', { action: actionLabel, heading: headingText || headingId })"
      :aria-busy="copying || undefined"
      @click="copy"
    >
      <Icon :name="copied ? 'lucide:check' : 'lucide:hash'" size="16" aria-hidden="true" />
    </button>
  </CommonTooltip>
</template>

<script setup lang="ts">
const props = defineProps<{ headingId: string; headingText: string }>()

const { t } = useI18n()
const copied = ref(false)
const actionLabel = computed(() => (copied.value ? t('article.headingAnchor.copied') : t('article.headingAnchor.copy')))
const copying = ref(false)
const { success: notifyCopied, warning: notifyCopyFailure } = useToast()
let copyTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => {
  alive = false
  if (copyTimer) clearTimeout(copyTimer)
})

async function copy() {
  if (copying.value) return
  copying.value = true
  copied.value = false
  if (copyTimer) clearTimeout(copyTimer)
  try {
    // 点击时读取当前完整地址，只替换片段，避免沿用上一篇文章或已有的目录锚点
    const url = new URL(window.location.href)
    url.hash = props.headingId
    await navigator.clipboard.writeText(url.href)
    if (!alive) return
    copied.value = true
    notifyCopied(t('article.headingAnchor.toast'))
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    if (alive) notifyCopyFailure(t('article.headingAnchor.failed'))
  } finally {
    if (alive) copying.value = false
  }
}
</script>

<style lang="scss" scoped>
.heading-anchor {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover,
  &:focus-visible {
    background: var(--surface-3);
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
