<!--
  @file MessageBubble.vue
  @description 单条留言气泡，访客左对齐、博主右对齐，支持回复引用、反应、消息状态
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div
    class="message-bubble"
    :class="message.isOwner ? 'message-bubble--owner' : 'message-bubble--guest'"
  >
    <!-- 头像 -->
    <div class="message-bubble__avatar-wrap" @mouseenter="showUserCard = true" @mouseleave="showUserCard = false">
      <img
        class="message-bubble__avatar"
        :src="message.avatar"
        :alt="`${message.author} 的头像`"
        width="32"
        height="32"
      >
      <!-- 头像悬浮用户卡 -->
      <Transition name="user-card-fade">
        <div v-if="showUserCard" class="message-bubble__user-card" :class="{ 'message-bubble__user-card--right': message.isOwner }">
          <img class="message-bubble__user-card-avatar" :src="message.avatar" :alt="message.author" width="40" height="40">
          <div class="message-bubble__user-card-info">
            <span class="message-bubble__user-card-name">
              {{ message.author }}
              <span v-if="message.isOwner" class="message-bubble__owner-badge message-bubble__owner-badge--sm">博主</span>
            </span>
            <span v-if="message.region" class="message-bubble__user-card-region">
              <Icon name="lucide:map-pin" size="11" />
              {{ message.region }}
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <div
      class="message-bubble__col"
      :class="{ 'message-bubble__col--end': message.isOwner }"
    >
      <!-- 用户名和时间 -->
      <div
        class="message-bubble__meta"
        :class="{ 'message-bubble__meta--reverse': message.isOwner }"
      >
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

      <!-- 回复引用 -->
      <div
        v-if="message.replyTo"
        class="message-bubble__reply"
        :class="{ 'message-bubble__reply--end': message.isOwner }"
      >
        <Icon name="lucide:corner-up-right" size="12" class="message-bubble__reply-icon" />
        <span class="message-bubble__reply-author">{{ message.replyTo.author }}</span>
        <span class="message-bubble__reply-content">{{ message.replyTo.content }}</span>
      </div>

      <!-- 气泡主体 -->
      <div class="message-bubble__body">
        <div
          class="message-bubble__content"
          :class="message.isOwner ? 'message-bubble__content--owner' : 'message-bubble__content--guest'"
        >
          <!-- 气泡尾巴 -->
          <span class="message-bubble__tail" :class="message.isOwner ? 'message-bubble__tail--owner' : 'message-bubble__tail--guest'" />
          {{ message.content }}
        </div>
        <!-- 操作按钮 -->
        <div
          class="message-bubble__actions"
          :class="{ 'message-bubble__actions--left': message.isOwner }"
        >
          <CommonTooltip content="回复">
            <button type="button" class="message-bubble__action" @click="$emit('reply', message)">
              <Icon name="lucide:reply" size="13" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="复制">
            <button type="button" class="message-bubble__action" @click="copyContent">
              <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="13" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="表情">
            <button type="button" class="message-bubble__action" @click="showReactionPicker = !showReactionPicker">
              <Icon name="lucide:smile-plus" size="13" />
            </button>
          </CommonTooltip>
        </div>
      </div>

      <!-- 反应 emoji 选择器 -->
      <Transition name="picker-fade">
        <div v-if="showReactionPicker" class="message-bubble__reaction-picker" :class="{ 'message-bubble__reaction-picker--end': message.isOwner }">
          <button
            v-for="emoji in reactionEmojis"
            :key="emoji"
            type="button"
            class="message-bubble__reaction-pick"
            @click="addReaction(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </Transition>

      <!-- 已有的反应 -->
      <div
        v-if="reactions.length > 0"
        class="message-bubble__reactions"
        :class="{ 'message-bubble__reactions--end': message.isOwner }"
      >
        <button
          v-for="r in reactions"
          :key="r.emoji"
          type="button"
          class="message-bubble__reaction"
          :class="{ 'message-bubble__reaction--active': r.reacted }"
          @click="toggleReaction(r.emoji)"
        >
          <span class="message-bubble__reaction-emoji">{{ r.emoji }}</span>
          <span class="message-bubble__reaction-count">{{ r.count }}</span>
        </button>
      </div>

      <!-- 底部信息行：浏览器 + 地区 + 状态 -->
      <div
        v-if="message.browser || message.region || message.status"
        class="message-bubble__foot"
        :class="{ 'message-bubble__foot--end': message.isOwner }"
      >
        <span v-if="message.browser" class="message-bubble__browser">
          <Icon name="lucide:monitor" size="12" class="message-bubble__browser-icon" />
          {{ message.browser }}
        </span>
        <template v-if="message.browser && message.region">
          <span class="message-bubble__dot">&middot;</span>
        </template>
        <span v-if="message.region" class="message-bubble__region">
          <Icon name="lucide:map-pin" size="12" class="message-bubble__region-icon" />
          {{ message.region }}
        </span>
        <!-- 消息状态指示 -->
        <template v-if="message.status && message.isOwner">
          <span class="message-bubble__dot">&middot;</span>
          <span class="message-bubble__status" :class="`message-bubble__status--${message.status}`">
            <Icon v-if="message.status === 'sending'" name="lucide:loader-2" size="11" class="message-bubble__status-spin" />
            <Icon v-else-if="message.status === 'sent'" name="lucide:check" size="11" />
            <Icon v-else name="lucide:check-check" size="11" />
            {{ statusText }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage, MessageReaction } from '~/features/guestbook/types'

const props = defineProps<{
  message: GuestMessage
}>()

defineEmits<{
  reply: [message: GuestMessage]
}>()

const copied = ref(false)
const showReactionPicker = ref(false)
const showUserCard = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

/** 可选的反应 emoji */
const reactionEmojis = ['👍', '❤️', '🎉', '🔥', '😄', '🙏', '📷', '💡']

/** 响应式反应列表 */
const reactions = ref<MessageReaction[]>(
  props.message.reactions ? [...props.message.reactions.map(r => ({ ...r }))] : [],
)

const statusText = computed(() => {
  switch (props.message.status) {
    case 'sending': return '发送中'
    case 'sent': return '已发送'
    case 'read': return '已读'
    default: return ''
  }
})

function copyContent() {
  navigator.clipboard.writeText(props.message.content)
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = false }, 1500)
}

function toggleReaction(emoji: string) {
  const existing = reactions.value.find(r => r.emoji === emoji)
  if (existing) {
    if (existing.reacted) {
      existing.count--
      existing.reacted = false
      if (existing.count <= 0) {
        reactions.value = reactions.value.filter(r => r.emoji !== emoji)
      }
    } else {
      existing.count++
      existing.reacted = true
    }
  }
}

function addReaction(emoji: string) {
  const existing = reactions.value.find(r => r.emoji === emoji)
  if (existing) {
    if (!existing.reacted) {
      existing.count++
      existing.reacted = true
    }
  } else {
    reactions.value.push({ emoji, count: 1, reacted: true })
  }
  showReactionPicker.value = false
}

onBeforeUnmount(() => {
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
  cursor: pointer;
  transition: transform 0.15s;

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
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.user-card-fade-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
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
.message-bubble__content {
  position: relative;
  font-size: 0.8125rem;
  line-height: 1.625;
  padding: 0.625rem 1rem;
  border-radius: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  word-break: break-word;
  white-space: pre-wrap;

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
  transition: opacity 0.15s ease;
  flex-shrink: 0;

  .message-bubble:hover & {
    opacity: 1;
  }

  &--left {
    order: -1;
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
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
    border-color: var(--border);
  }
}

/* ---- 反应 emoji 选择器 ---- */
.message-bubble__reaction-picker {
  display: flex;
  gap: 0.125rem;
  padding: 0.25rem;
  border-radius: $radius-md;
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.12));
  width: fit-content;

  &--end {
    align-self: flex-end;
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
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);
    transform: scale(1.2);
  }
}

.picker-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-fade-leave-active {
  transition: opacity 0.1s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* ---- 反应列表 ---- */
.message-bubble__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;

  &--end {
    justify-content: flex-end;
  }
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
  cursor: pointer;
  transition: all 0.15s;

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

  &--end {
    justify-content: flex-end;
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
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
