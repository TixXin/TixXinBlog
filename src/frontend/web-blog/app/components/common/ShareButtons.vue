<!--
  @file ShareButtons.vue
  @description 社交分享按钮组件，支持系统分享、复制链接、Twitter/X、微博；分享地址使用规范地址（canonical）
  @author TixXin
  @since 2026-04-06
-->

<template>
  <div class="share-buttons">
    <span class="share-buttons__label">{{ $t('layout.share.label') }}</span>
    <button
      v-if="canNativeShare"
      type="button"
      class="share-buttons__btn"
      :aria-label="$t('layout.share.native')"
      @click="shareNative"
    >
      <Icon name="lucide:share-2" size="14" />
    </button>
    <button type="button" class="share-buttons__btn" :aria-label="$t('layout.share.copy')" @click="copyLink">
      <Icon :name="copied ? 'lucide:check' : 'lucide:link'" size="14" />
    </button>
    <button type="button" class="share-buttons__btn" :aria-label="$t('layout.share.twitter')" @click="shareTwitter">
      <Icon name="lucide:twitter" size="14" />
    </button>
    <button type="button" class="share-buttons__btn" :aria-label="$t('layout.share.weibo')" @click="shareWeibo">
      <Icon name="lucide:globe" size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  url?: string
}>()

const { t } = useI18n()
const copied = ref(false)
const { warning: notifyCopyFailure } = useToast()
let copyTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => {
  alive = false
  if (copyTimer) clearTimeout(copyTimer)
})

// 分享地址优先使用显式传入值，其次读取页面 canonical，避免把筛选、跟踪等查询参数带出去
function shareUrl() {
  if (props.url) return props.url
  if (!import.meta.client) return ''
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
  return canonical || window.location.origin + window.location.pathname
}

// navigator.share 只在客户端挂载后探测，保持 SSR 与首帧一致
const canNativeShare = ref(false)
onMounted(() => {
  canNativeShare.value = typeof navigator.share === 'function'
})

async function shareNative() {
  try {
    await navigator.share({ title: props.title, url: shareUrl() })
  } catch (error) {
    // 用户取消分享属于正常结果，不提示
    if ((error as DOMException)?.name !== 'AbortError' && alive) notifyCopyFailure(t('layout.share.nativeFailed'))
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl())
    if (!alive) return
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    if (alive) notifyCopyFailure(t('layout.share.copyFailed'))
  }
}

// 第三方分享窗口不持有本页 opener，也不接收来源地址
function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400')
}

function shareTwitter() {
  openShareWindow(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(props.title)}&url=${encodeURIComponent(shareUrl())}`,
  )
}

function shareWeibo() {
  openShareWindow(
    `https://service.weibo.com/share/share.php?title=${encodeURIComponent(props.title)}&url=${encodeURIComponent(shareUrl())}`,
  )
}
</script>

<style lang="scss" scoped>
.share-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.share-buttons__label {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-right: 0.25rem;
}

.share-buttons__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    border-color: var(--border-hover);
  }
}
</style>
