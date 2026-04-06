<!--
  @file ShareButtons.vue
  @description 社交分享按钮组件，支持复制链接、Twitter/X、微博
  @author TixXin
  @since 2026-04-06
-->

<template>
  <div class="share-buttons">
    <span class="share-buttons__label">分享</span>
    <button type="button" class="share-buttons__btn" aria-label="复制链接" @click="copyLink">
      <Icon :name="copied ? 'lucide:check' : 'lucide:link'" size="14" />
    </button>
    <button type="button" class="share-buttons__btn" aria-label="分享到 Twitter" @click="shareTwitter">
      <Icon name="lucide:twitter" size="14" />
    </button>
    <button type="button" class="share-buttons__btn" aria-label="分享到微博" @click="shareWeibo">
      <Icon name="lucide:globe" size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  url?: string
}>()

const copied = ref(false)

const shareUrl = computed(() => {
  if (props.url) return props.url
  if (import.meta.client) return window.location.href
  return ''
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard not available */
  }
}

function shareTwitter() {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(props.title)}&url=${encodeURIComponent(shareUrl.value)}`
  window.open(url, '_blank', 'width=600,height=400')
}

function shareWeibo() {
  const url = `https://service.weibo.com/share/share.php?title=${encodeURIComponent(props.title)}&url=${encodeURIComponent(shareUrl.value)}`
  window.open(url, '_blank', 'width=600,height=400')
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
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    border-color: var(--border-hover);
  }
}
</style>
