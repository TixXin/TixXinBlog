<!--
  @file MessageBubbleActions.vue
  @description 留言气泡操作按钮栏与表情反应选择浮层
  @author TixXin
  @since 2026-10-21
-->

<template>
  <!-- 操作按钮 -->
  <div class="message-bubble__actions" :class="{ 'message-bubble__actions--left': message.isOwner }">
    <CommonTooltip :content="$t('interaction.guestbookBubble.reply')">
      <button
        type="button"
        class="message-bubble__action"
        :aria-label="$t('interaction.guestbookBubble.replyTo', { author: message.author })"
        :disabled="message.moderationStatus !== 'published'"
        @click="$emit('reply', message)"
      >
        <Icon name="lucide:reply" size="13" />
      </button>
    </CommonTooltip>
    <CommonTooltip :content="$t('interaction.guestbookBubble.copy')">
      <button
        type="button"
        class="message-bubble__action"
        :aria-label="$t('interaction.guestbookBubble.copyMessage')"
        @click="copyContent"
      >
        <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="13" />
      </button>
    </CommonTooltip>
    <CommonTooltip :content="$t('interaction.guestbookBubble.emoji')" :disabled="pickerOpen">
      <button
        ref="reactionButton"
        type="button"
        class="message-bubble__action"
        :aria-label="$t('interaction.guestbookBubble.addReaction')"
        :disabled="!interactive || reacting || message.moderationStatus !== 'published'"
        :aria-expanded="pickerOpen"
        @click="toggleReactionPicker"
      >
        <Icon name="lucide:smile-plus" size="13" />
      </button>
    </CommonTooltip>
  </div>
  <!-- 反应选择器：浮层定位在气泡旁，不参与排版 -->
  <Transition name="picker-fade">
    <div
      v-if="pickerOpen"
      ref="reactionPicker"
      role="group"
      :aria-label="$t('interaction.guestbookBubble.pickReaction')"
      class="message-bubble__reaction-picker"
      :class="{
        'message-bubble__reaction-picker--end': message.isOwner,
        'message-bubble__reaction-picker--above': pickerAbove,
      }"
      @keydown.escape.stop="closeReactions"
    >
      <button
        v-for="option in reactionOptions"
        :key="option.value"
        type="button"
        :aria-label="$t(option.labelKey)"
        :disabled="reacting"
        class="message-bubble__reaction-pick"
        @click="addReaction(option.value)"
      >
        <Icon :name="option.icon" size="16" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'
import { REACTION_OPTIONS } from '~/features/guestbook/reactions'

const props = defineProps<{
  message: GuestMessage
  interactive?: boolean
  reacting?: boolean
  pickerOpen: boolean
}>()

const emit = defineEmits<{
  'update:pickerOpen': [value: boolean]
  reply: [message: GuestMessage]
  react: [emoji: string]
}>()

const { t } = useI18n()
const { error: showError } = useToast()

const reactionOptions = REACTION_OPTIONS
const reactionButton = ref<HTMLButtonElement | null>(null)
const reactionPicker = ref<HTMLElement | null>(null)
const pickerAbove = ref(false)
const PICKER_SPACE = 64

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
  } catch {
    showError(t('interaction.guestbookBubble.copyFailed'))
    return
  }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

function scrollParent(el: HTMLElement | null) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node
  }
  return null
}

function toggleReactionPicker() {
  if (props.pickerOpen) {
    emit('update:pickerOpen', false)
    return
  }
  const button = reactionButton.value
  const bottomLimit = scrollParent(button)?.getBoundingClientRect().bottom ?? window.innerHeight
  pickerAbove.value = !!button && button.getBoundingClientRect().bottom + PICKER_SPACE > bottomLimit
  emit('update:pickerOpen', true)
}

function closeReactions() {
  emit('update:pickerOpen', false)
  nextTick(() => reactionButton.value?.focus())
}

function addReaction(emoji: string) {
  emit('react', emoji)
  closeReactions()
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node
  if (reactionPicker.value?.contains(target) || reactionButton.value?.contains(target)) return
  emit('update:pickerOpen', false)
}

function onPickerEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') closeReactions()
}

function unbindPickerDismiss() {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  document.removeEventListener('keydown', onPickerEscape)
}

watch(
  () => props.pickerOpen,
  (open) => {
    if (!open) return unbindPickerDismiss()
    document.addEventListener('pointerdown', onOutsidePointer, true)
    document.addEventListener('keydown', onPickerEscape)
  },
)

onBeforeUnmount(() => {
  unbindPickerDismiss()
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style lang="scss" scoped>
/* ---- 操作按钮 ---- */
.message-bubble__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  // 触屏隐藏时不接收点击，避免误触看不见的按钮；鼠标设备总是先悬停才会点到，保持可点
  @media (hover: none) {
    pointer-events: none;
  }
  transition: opacity 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  flex-shrink: 0;

  // 鼠标点击留下的焦点不算，移开即淡出；键盘焦点与打开的表情浮层保持显示
  :global(.message-bubble:hover) &,
  :global(.message-bubble:has(:focus-visible)) &,
  :global(.message-bubble--picker-open) &,
  :global(.message-bubble--actions-open) & {
    opacity: 1;
    pointer-events: auto;
  }

  &--left {
    order: -1;
  }

  // 窄屏不给按钮常驻占位，轻点后浮在气泡外上角，气泡拿回整行宽度
  @media (max-width: #{$breakpoint-sm - 1px}) {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    right: 0;
    z-index: 6;
    padding: 0.125rem;
    border: 1px solid var(--border-soft);
    border-radius: $radius-sm;
    background: var(--surface-1);
    box-shadow: var(--shadow-card);

    &--left {
      right: auto;
      left: 0;
    }
  }
}

.message-bubble__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: $radius-sm;
  border: 1px solid var(--border-soft);
  background: var(--surface-1);
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    border-color: var(--border);
  }
}

/* ---- 反应 emoji 选择器 ---- */
.message-bubble__reaction-picker {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 15;
  display: flex;
  flex-wrap: wrap;
  max-width: min(17.5rem, calc(100vw - 2rem));
  gap: 0.125rem;
  padding: 0.25rem;
  border-radius: $radius-md;
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.12));
  width: max-content;

  &--end {
    left: auto;
    right: 0;
  }

  &--above {
    top: auto;
    bottom: calc(100% + 0.375rem);
  }
}

.message-bubble__reaction-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  font-size: 1rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    transform: scale(1.2);
  }
}

.picker-fade-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.picker-fade-leave-active {
  transition: opacity 0.1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
