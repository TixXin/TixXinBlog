<!-- @file Detail.vue @description 提示词阅读浮层，完整文本、复制反馈和可分享链接 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dialog"
      class="prompt-detail"
      role="dialog"
      aria-modal="true"
      :aria-label="item?.title || $t('misc.prompt.detail.fallbackLabel')"
      tabindex="-1"
      @click.self="$emit('close')"
      @keydown="navigateWithKeyboard"
    >
      <div class="prompt-detail__panel">
        <PromptDetailToolbar
          :draft="draft"
          :navigation-count="navigationCount"
          :position="position"
          :can-previous="canPrevious"
          :can-next="canNext"
          :pending="pending"
          @previous="$emit('previous')"
          @next="$emit('next')"
          @close="$emit('close')"
        />
        <div v-if="copyMessage" class="prompt-detail__notice">
          <p role="status" class="prompt-detail__copy-status">{{ copyMessage }}</p>
          <label v-if="manualLink" class="prompt-detail__manual-link"
            >{{ $t('misc.prompt.detail.shareLink')
            }}<input
              :value="manualLink"
              readonly
              @focus="($event.target as HTMLInputElement).select()"
              @click="($event.target as HTMLInputElement).select()"
          /></label>
        </div>
        <div class="prompt-detail__content">
          <div v-if="pending || error" class="prompt-detail__feedback">
            <CommonRequestFeedback
              :pending="pending"
              :title="error || $t('misc.prompt.detail.loading')"
              @retry="$emit('retry')"
            />
          </div>
          <template v-else-if="item">
            <div class="prompt-detail__image">
              <CommonImageFrame
                :src="item.imageUrl"
                :alt="item.imageAlt || item.title"
                :width="item.width || undefined"
                :height="item.height || undefined"
                fit="contain"
                loading="eager"
              />
              <a class="prompt-detail__original" :href="item.imageUrl" target="_blank" rel="noopener noreferrer">
                <Icon name="lucide:expand" size="14" />{{ $t('misc.prompt.detail.viewOriginal')
                }}<span class="sr-only">{{ $t('misc.prompt.detail.newTab') }}</span>
              </a>
            </div>
            <PromptDetailBody
              :item="item"
              :editable="editable"
              :draft="draft"
              :copied="copied"
              :copying="copying"
              @copy="copy"
              @share="share"
              @edit="$emit('edit', $event)"
            />
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { ImagePrompt } from '~/features/prompt/types'

const props = withDefaults(
  defineProps<{
    visible: boolean
    item: ImagePrompt | null
    pending: boolean
    error: string
    editable: boolean
    draft: boolean
    position?: number
    navigationCount?: number
    canPrevious?: boolean
    canNext?: boolean
  }>(),
  { position: 0, navigationCount: 0, canPrevious: false, canNext: false },
)
const emit = defineEmits<{ close: []; retry: []; edit: [id: number]; previous: []; next: [] }>()
const { t } = useI18n()
const dialog = ref<HTMLElement | null>(null),
  copied = ref(''),
  copyMessage = ref(''),
  copying = ref(false),
  manualLink = ref('')
let copyGeneration = 0
let timer: ReturnType<typeof setTimeout> | undefined
useModalFocus(() => props.visible, dialog, {
  close: () => emit('close'),
  initialFocus: () => dialog.value?.querySelector<HTMLButtonElement>('.prompt-detail__close') ?? null,
})
function navigateWithKeyboard(event: KeyboardEvent) {
  if (
    props.pending ||
    !props.visible ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return
  const target = event.target instanceof HTMLElement ? event.target : null
  if (target?.closest('input, textarea, select, [contenteditable="true"]') || window.getSelection()?.toString()) return
  const direction =
    event.key === 'ArrowLeft' && props.canPrevious
      ? 'previous'
      : event.key === 'ArrowRight' && props.canNext
        ? 'next'
        : null
  if (!direction) return
  event.preventDefault()
  // 正文按钮会在载入时被替换；先转到常驻导航入口，避免下一次方向键落到页面背景。
  const targetLabel = t(direction === 'previous' ? 'misc.prompt.detail.previous' : 'misc.prompt.detail.next')
  dialog.value?.querySelector<HTMLButtonElement>(`[aria-label="${targetLabel}"]`)?.focus({ preventScroll: true })
  if (direction === 'previous') emit('previous')
  else emit('next')
}
async function copy(text: string, kind: string) {
  if (copying.value) return
  const generation = ++copyGeneration
  clearTimeout(timer)
  copying.value = true
  copied.value = ''
  manualLink.value = ''
  copyMessage.value = ''
  try {
    await navigator.clipboard.writeText(text)
    if (generation !== copyGeneration || !props.visible) return
    copied.value = kind
    copyMessage.value = t(kind === 'link' ? 'misc.prompt.detail.copiedLink' : 'misc.prompt.detail.copiedPrompt')
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = ''
      copyMessage.value = ''
    }, 2500)
  } catch {
    if (generation !== copyGeneration || !props.visible) return
    copied.value = ''
    if (kind === 'link') {
      manualLink.value = text
      copyMessage.value = t('misc.prompt.detail.clipboardDenied')
    } else copyMessage.value = t('misc.prompt.detail.copyFailed')
  } finally {
    if (generation === copyGeneration) copying.value = false
  }
}
function share() {
  if (props.item) void copy(`${window.location.origin}/prompts?prompt=${props.item.id}`, 'link')
}
watch([() => props.visible, () => props.item], () => {
  copyGeneration++
  copying.value = false
  copied.value = ''
  copyMessage.value = ''
  manualLink.value = ''
  clearTimeout(timer)
})
onBeforeUnmount(() => {
  copyGeneration++
  clearTimeout(timer)
})
</script>
<style scoped lang="scss">
.prompt-detail {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(10, 14, 20, 0.65);
  backdrop-filter: blur(8px);
}
.prompt-detail__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  max-height: min(90dvh, 960px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  background: var(--surface-1);
  box-shadow: 0 20px 80px #0003;
}
.prompt-detail__content {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  overflow: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
.prompt-detail__image {
  min-height: min(320px, 60dvh);
  position: sticky;
  top: 0;
  height: calc(min(90dvh, 960px) - 1.2rem - 41px);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  background: var(--surface-2);
}
.prompt-detail__image :deep(.image-frame) {
  max-height: 100%;
}
.prompt-detail__original {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  color: var(--text-main);
  background: var(--surface-1);
  font-size: 0.75rem;
}
.prompt-detail__original:hover {
  color: var(--accent-text);
  border-color: var(--accent);
}
.prompt-detail__manual-link {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.75rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompt-detail__manual-link input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.6rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
}
button,
a {
  cursor: var(--interaction-cursor, pointer);
}
.prompt-detail__copy-status {
  font-size: 0.75rem;
  color: var(--accent-text);
  line-height: 1.7;
}
.prompt-detail__notice {
  flex-shrink: 0;
  padding: 0.65rem 1.4rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.prompt-detail__feedback {
  grid-column: 1 / -1;
  min-height: 200px;
  padding: 3rem;
}
@media (max-width: 700px) {
  .prompt-detail {
    padding: 0.75rem;
  }
  .prompt-detail__panel {
    max-height: 94dvh;
  }
  .prompt-detail__content {
    display: block;
  }
  .prompt-detail__image {
    position: relative;
    height: 38dvh;
    min-height: min(180px, 30dvh);
    padding: 1rem;
  }
}
</style>
