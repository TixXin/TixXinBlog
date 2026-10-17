<!--
  @file MessageBubble.vue
  @description 单条留言气泡，访客左对齐、博主右对齐，支持回复引用、反应、消息状态
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div
    ref="rootRef"
    class="message-bubble"
    :data-guestbook-id="message.id"
    :class="[
      message.isOwner ? 'message-bubble--owner' : 'message-bubble--guest',
      { 'message-bubble--picker-open': showReactionPicker, 'message-bubble--actions-open': actionsOpen },
    ]"
  >
    <!-- 头像 -->
    <div class="message-bubble__avatar-wrap" @mouseenter="showUserCard = true" @mouseleave="showUserCard = false">
      <img
        class="message-bubble__avatar"
        :src="message.avatar || '/avatar.svg'"
        :alt="`${message.author} 的头像`"
        width="32"
        height="32"
      />
      <!-- 头像悬浮用户卡 -->
      <Transition name="user-card-fade">
        <div
          v-if="showUserCard"
          class="message-bubble__user-card"
          :class="{ 'message-bubble__user-card--right': message.isOwner }"
        >
          <img
            class="message-bubble__user-card-avatar"
            :src="message.avatar || '/avatar.svg'"
            :alt="message.author"
            width="40"
            height="40"
          />
          <div class="message-bubble__user-card-info">
            <span class="message-bubble__user-card-name">
              {{ message.author }}
              <span v-if="message.isOwner" class="message-bubble__owner-badge message-bubble__owner-badge--sm"
                >博主</span
              >
            </span>
            <span v-if="message.region" class="message-bubble__user-card-region">
              <Icon name="lucide:map-pin" size="11" />
              {{ message.region }}
            </span>
            <span v-if="message.browser" class="message-bubble__user-card-region">
              <Icon name="lucide:globe" size="11" />
              {{ message.browser }}
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <div class="message-bubble__col" :class="{ 'message-bubble__col--end': message.isOwner }">
      <!-- 用户名和时间 -->
      <div class="message-bubble__meta" :class="{ 'message-bubble__meta--reverse': message.isOwner }">
        <template v-if="message.isOwner">
          <span class="message-bubble__time">{{ message.time }}</span>
          <span class="message-bubble__name">{{ message.author }}</span>
          <span class="message-bubble__owner-badge">博主</span>
        </template>
        <template v-else>
          <span class="message-bubble__name">{{ message.author }}</span>
          <span class="message-bubble__time">{{ message.time }}</span>
        </template>
      </div>

      <!-- 回复引用：点击跳到原留言 -->
      <button
        v-if="message.replyTo"
        type="button"
        class="message-bubble__reply message-bubble__reply--link"
        :class="{ 'message-bubble__reply--end': message.isOwner }"
        :aria-label="`跳到 ${message.replyTo.author} 的原留言：${message.replyTo.content}`"
        @click="$emit('jump', { target: message.replyTo.id, from: message.id })"
      >
        <Icon name="lucide:corner-up-right" size="12" class="message-bubble__reply-icon" />
        <span class="message-bubble__reply-author">{{ message.replyTo.author }}</span>
        <span class="message-bubble__reply-content">{{ message.replyTo.content }}</span>
      </button>

      <p v-if="message.replyUnavailable" class="message-bubble__reply">所引用的留言暂不可见</p>
      <p v-if="message.moderationStatus === 'pending'" class="message-bubble__foot">待审核，仅自己可见</p>
      <p v-if="reactionError" role="alert" class="message-bubble__foot">{{ reactionError }}</p>
      <!-- 气泡主体 -->
      <div class="message-bubble__body">
        <div
          class="message-bubble__content"
          :class="message.isOwner ? 'message-bubble__content--owner' : 'message-bubble__content--guest'"
          @click="onContentTap"
        >
          <!-- 气泡尾巴 -->
          <span
            class="message-bubble__tail"
            :class="message.isOwner ? 'message-bubble__tail--owner' : 'message-bubble__tail--guest'"
          />
          <!-- 换行保留只作用在正文上，模板缩进产生的空白不再变成首行缩进 -->
          <span class="message-bubble__text">{{ message.content }}</span>
        </div>
        <!-- 操作按钮 -->
        <div class="message-bubble__actions" :class="{ 'message-bubble__actions--left': message.isOwner }">
          <CommonTooltip content="回复">
            <button
              type="button"
              class="message-bubble__action"
              :aria-label="`回复${message.author}的留言`"
              :disabled="message.moderationStatus !== 'published'"
              @click="$emit('reply', message)"
            >
              <Icon name="lucide:reply" size="13" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="复制">
            <button type="button" class="message-bubble__action" aria-label="复制留言" @click="copyContent">
              <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="13" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="表情" :disabled="showReactionPicker">
            <button
              ref="reactionButton"
              type="button"
              class="message-bubble__action"
              aria-label="添加回应"
              :disabled="!interactive || reacting || message.moderationStatus !== 'published'"
              :aria-expanded="showReactionPicker"
              @click="toggleReactionPicker"
            >
              <Icon name="lucide:smile-plus" size="13" />
            </button>
          </CommonTooltip>
        </div>
        <!-- 反应选择器：浮层定位在气泡旁，不参与排版 -->
        <Transition name="picker-fade">
          <div
            v-if="showReactionPicker"
            ref="reactionPicker"
            role="group"
            aria-label="选择回应"
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
              :aria-label="option.label"
              :disabled="reacting"
              class="message-bubble__reaction-pick"
              @click="addReaction(option.value)"
            >
              <Icon :name="option.icon" size="16" />
            </button>
          </div>
        </Transition>
      </div>

      <!-- 浏览器、地区与已有反应同排：设备信息靠头像一侧，反应靠气泡外缘，空间不足时才换行 -->
      <div
        v-if="reactions.length > 0 || message.browser || message.region"
        class="message-bubble__extras"
        :class="{ 'message-bubble__extras--end': message.isOwner }"
      >
        <div v-if="reactions.length > 0" class="message-bubble__reactions">
          <button
            v-for="r in reactions"
            :key="r.emoji"
            type="button"
            class="message-bubble__reaction"
            :class="{ 'message-bubble__reaction--active': r.reacted }"
            :aria-label="`${reactionMeta(r.emoji).label}，${r.count} 次回应`"
            :aria-pressed="r.reacted"
            :disabled="!interactive || reacting || message.moderationStatus !== 'published'"
            @click="toggleReaction(r.emoji)"
          >
            <Icon :name="reactionMeta(r.emoji).icon" size="15" />
            <span class="message-bubble__reaction-count">{{ r.count }}</span>
          </button>
        </div>
        <p v-if="message.browser || message.region" class="message-bubble__foot message-bubble__foot--inline">
          <span v-if="message.browser" class="message-bubble__browser">
            <Icon name="lucide:monitor" size="11" class="message-bubble__browser-icon" />
            {{ message.browser }}
          </span>
          <span v-if="message.browser && message.region" class="message-bubble__dot">·</span>
          <span v-if="message.region" class="message-bubble__region">
            <Icon name="lucide:map-pin" size="11" class="message-bubble__region-icon" />
            {{ message.region }}
          </span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

const props = defineProps<{
  message: GuestMessage
  interactive?: boolean
  reacting?: boolean
  reactionError?: string
}>()

const emit = defineEmits<{
  react: [value: { id: number; emoji: string; reacted: boolean; complete?: () => void }]
  reply: [message: GuestMessage]
  jump: [value: { target: number; from: number }]
}>()

const copied = ref(false)
const { error: showError } = useToast()
const showReactionPicker = ref(false)
const showUserCard = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

/** 保留示例数据的反应值，界面统一使用Lucide与明确名称。 */
const reactionOptions = [
  { value: '👍', icon: 'lucide:thumbs-up', label: '赞' },
  { value: '❤️', icon: 'lucide:heart', label: '喜欢' },
  { value: '🎉', icon: 'lucide:party-popper', label: '庆祝' },
  { value: '🔥', icon: 'lucide:flame', label: '热情' },
  { value: '😄', icon: 'lucide:smile', label: '开心' },
  { value: '🙏', icon: 'lucide:hand-heart', label: '感谢' },
  { value: '📷', icon: 'lucide:camera', label: '摄影' },
  { value: '💡', icon: 'lucide:lightbulb', label: '灵感' },
]
const reactionButton = ref<HTMLButtonElement | null>(null)
const reactionPicker = ref<HTMLElement | null>(null)
/** 气泡下方空间不足（会被滚动区或输入框遮住）时改为向上弹出 */
const pickerAbove = ref(false)
const PICKER_SPACE = 64

/** 最近的滚动容器，用来判断浮层能否完整显示在气泡下方 */
function scrollParent(el: HTMLElement | null) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node
  }
  return null
}

function toggleReactionPicker() {
  if (showReactionPicker.value) {
    showReactionPicker.value = false
    return
  }
  const button = reactionButton.value
  const bottomLimit = scrollParent(button)?.getBoundingClientRect().bottom ?? window.innerHeight
  pickerAbove.value = !!button && button.getBoundingClientRect().bottom + PICKER_SPACE > bottomLimit
  showReactionPicker.value = true
}

/** 触屏没有悬停：轻点气泡切换操作按钮，点到本条消息以外即收起 */
const actionsOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
function onContentTap() {
  if (!matchMedia('(hover: none)').matches || getSelection()?.toString()) return
  actionsOpen.value = !actionsOpen.value
}
function onOutsideTap(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) actionsOpen.value = false
}
watch(actionsOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onOutsideTap, true)
  else document.removeEventListener('pointerdown', onOutsideTap, true)
})

/** 浮层打开时，点击浮层与触发按钮以外的区域即收起 */
function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node
  if (reactionPicker.value?.contains(target) || reactionButton.value?.contains(target)) return
  showReactionPicker.value = false
}
/** 焦点仍在触发按钮上时也能用 Esc 收起 */
function onPickerEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') closeReactions()
}
function unbindPickerDismiss() {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  document.removeEventListener('keydown', onPickerEscape)
}
watch(showReactionPicker, (open) => {
  if (!open) return unbindPickerDismiss()
  document.addEventListener('pointerdown', onOutsidePointer, true)
  document.addEventListener('keydown', onPickerEscape)
})
const reactionMeta = (value: string) =>
  reactionOptions.find((option) => option.value === value) ?? { icon: 'lucide:smile', label: '回应' }
function closeReactions() {
  showReactionPicker.value = false
  nextTick(() => reactionButton.value?.focus())
}

const reactions = computed(() => props.message.reactions ?? [])

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
  } catch {
    showError('复制失败，请重试或手动选择留言内容')
    return
  }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

function sendReaction(emoji: string, reacted: boolean) {
  if (!props.interactive || props.reacting || props.message.moderationStatus !== 'published') return
  emit('react', {
    id: props.message.id,
    emoji,
    reacted,
    complete: () => {
      if (document.activeElement === document.body) reactionButton.value?.focus({ preventScroll: true })
    },
  })
}
function toggleReaction(emoji: string) {
  sendReaction(emoji, !reactions.value.find((item) => item.emoji === emoji)?.reacted)
}
function addReaction(emoji: string) {
  sendReaction(emoji, true)
  closeReactions()
}

onBeforeUnmount(() => {
  unbindPickerDismiss()
  document.removeEventListener('pointerdown', onOutsideTap, true)
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style lang="scss" scoped>
.message-bubble {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  max-width: 100%;

  &--guest {
    flex-direction: row;
  }

  &--owner {
    flex-direction: row-reverse;
  }

  // 浮层打开时整条消息抬到相邻消息之上，避免被后续消息覆盖
  &--picker-open {
    position: relative;
    z-index: 5;
  }
}

/* ---- 头像与悬浮卡 ---- */
.message-bubble__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.message-bubble__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow:
    0 0 0 2px var(--surface-1),
    0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: var(--interaction-cursor, pointer);
  transition: transform 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    transform: scale(1.08);
  }
}

/* 头像悬浮用户卡 */
.message-bubble__user-card {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  min-width: 180px;
  border-radius: $radius-md;
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0, 0, 0, 0.12));
  pointer-events: none;

  &--right {
    left: auto;
    right: 0;
  }
}

.message-bubble__user-card-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;
}

.message-bubble__user-card-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.message-bubble__user-card-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.message-bubble__user-card-region {
  font-size: 0.625rem;
  color: var(--text-faint);
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
}

.user-card-fade-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.user-card-fade-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.user-card-fade-enter-from,
.user-card-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---- 内容列 ---- */
.message-bubble__col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  max-width: 80%;

  &--end {
    align-items: flex-end;
  }

  @media (max-width: #{$breakpoint-sm - 1px}) {
    max-width: 88%;
  }
}

.message-bubble__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  &--reverse {
    flex-direction: row-reverse;
  }
}

.message-bubble__name {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
}

.message-bubble__time {
  font-size: 0.625rem;
  color: var(--text-faint);
  flex-shrink: 0;
}

.message-bubble__owner-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);

  &--sm {
    font-size: 0.5rem;
    padding: 0.0625rem 0.25rem;
  }
}

:root.dark .message-bubble__owner-badge {
  background: linear-gradient(135deg, #5b7cfa, #7b95ff);
}

/* ---- 回复引用 ---- */
.message-bubble__reply {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--surface-2);
  border-left: 2px solid var(--accent, #5b7cfa);
  max-width: 100%;
  overflow: hidden;

  &--end {
    border-left: none;
    border-right: 2px solid var(--accent, #5b7cfa);
  }

  &--link {
    font: inherit;
    text-align: left;
    color: inherit;
    border-top: none;
    border-bottom: none;
    cursor: var(--interaction-cursor, pointer);
    transition: background 0.15s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    &:hover {
      background: color-mix(in srgb, var(--accent, #5b7cfa) 10%, var(--surface-2));
    }

    &:focus-visible {
      outline: 2px solid var(--accent, #5b7cfa);
      outline-offset: 1px;
    }
  }
}

// 定位到的原留言短暂高亮，便于在长列表里找到
.message-bubble--located .message-bubble__content {
  animation: message-located 1.6s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    outline: 2px solid var(--accent, #5b7cfa);
    outline-offset: 2px;
  }
}

@keyframes message-located {
  0%,
  35% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #5b7cfa) 45%, transparent);
  }
  100% {
    box-shadow: 0 0 0 3px transparent;
  }
}

.message-bubble__reply-icon {
  flex-shrink: 0;
  color: var(--accent, #5b7cfa);
  opacity: 0.7;
}

.message-bubble__reply-author {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--accent, #5b7cfa);
}

.message-bubble__reply-content {
  font-size: 0.625rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 气泡主体 ---- */
.message-bubble__text {
  white-space: pre-wrap;
}

.message-bubble__content {
  position: relative;
  font-size: 0.8125rem;
  line-height: 1.625;
  padding: 0.625rem 1rem;
  border-radius: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  word-break: break-word;
  white-space: normal;

  &--guest {
    color: var(--text-main);
    background: var(--surface-2);
    border: 1px solid var(--border-soft);
    border-top-left-radius: $radius-sm;
  }

  &--owner {
    color: #f1f5f9;
    background: #1e293b;
    border-top-right-radius: $radius-sm;
  }
}

:root.dark .message-bubble__content--guest {
  background: rgba(49, 55, 65, 0.92);
  border-color: var(--border-soft);
}

:root.dark .message-bubble__content--owner {
  color: var(--text-main);
  background: rgba(91, 124, 250, 0.18);
  border: 1px solid rgba(91, 124, 250, 0.22);
}

/* 气泡尾巴 */
.message-bubble__tail {
  position: absolute;
  top: 0.625rem;
  width: 0;
  height: 0;

  &--guest {
    left: -6px;
    border-top: 5px solid var(--surface-2);
    border-left: 6px solid transparent;
    border-bottom: 5px solid transparent;
  }

  &--owner {
    right: -6px;
    border-top: 5px solid #1e293b;
    border-right: 6px solid transparent;
    border-bottom: 5px solid transparent;
  }
}

:root.dark .message-bubble__tail--guest {
  border-top-color: rgba(49, 55, 65, 0.92);
}

:root.dark .message-bubble__tail--owner {
  border-top-color: rgba(91, 124, 250, 0.18);
}

.message-bubble__body {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  position: relative;
}

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
  .message-bubble:hover &,
  .message-bubble:has(:focus-visible) &,
  .message-bubble--picker-open &,
  .message-bubble--actions-open & {
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

/* ---- 反应列表 ---- */
// 操作按钮常驻占位（3 个按钮 + 间距 + 与气泡的间隔），反应需让出这段宽度才能对齐气泡外缘
$actions-inset: 3 * 1.5rem + 2 * 0.125rem + 0.25rem;

.message-bubble__extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.625rem;
  padding-right: $actions-inset;

  @media (max-width: #{$breakpoint-sm - 1px}) {
    padding-right: 0;
  }

  .message-bubble__reactions {
    order: 1;
    margin-left: auto;
  }

  // 博主消息镜像：反应在左侧外缘，设备信息贴近头像
  &--end {
    padding-right: 0;
    padding-left: $actions-inset;

    @media (max-width: #{$breakpoint-sm - 1px}) {
      padding-left: 0;
    }

    .message-bubble__reactions {
      order: 0;
      margin-left: 0;
    }

    .message-bubble__foot {
      margin-left: auto;
    }
  }
}

.message-bubble__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.message-bubble__reaction {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: $radius-full;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  font-size: 0.6875rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--border);
    background: var(--surface-3, var(--surface-2));
  }

  &--active {
    border-color: color-mix(in srgb, var(--accent, #5b7cfa) 40%, transparent);
    background: color-mix(in srgb, var(--accent, #5b7cfa) 8%, var(--surface-2));
  }
}

.message-bubble__reaction-emoji {
  font-size: 0.8125rem;
  line-height: 1;
}

.message-bubble__reaction-count {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

/* ---- 底部信息 ---- */
.message-bubble__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.375rem;
  font-size: 0.625rem;
  color: var(--text-faint);
  margin-top: 0.125rem;

  &--inline {
    margin-top: 0;
  }
}

.message-bubble__browser,
.message-bubble__region {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
}

.message-bubble__browser-icon,
.message-bubble__region-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.message-bubble__dot {
  opacity: 0.5;
}

/* 消息状态 */
.message-bubble__status {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;

  &--sending {
    color: var(--text-faint);
  }

  &--sent {
    color: var(--text-faint);
  }

  &--read {
    color: #059669;
  }
}

:root.dark .message-bubble__status--read {
  color: #34d399;
}

.message-bubble__status-spin {
  animation: spin 1.2s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
