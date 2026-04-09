<!--
  @file MessageBubble.vue
  @description 单条留言气泡，访客左对齐、博主右对齐并区分背景
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div
    class="message-bubble"
    :class="message.isOwner ? 'message-bubble--owner' : 'message-bubble--guest'"
  >
    <img
      class="message-bubble__avatar"
      :src="message.avatar"
      :alt="`${message.author} 的头像`"
      width="32"
      height="32"
    >
    <div
      class="message-bubble__col"
      :class="{ 'message-bubble__col--end': message.isOwner }"
    >
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
      <div class="message-bubble__body">
        <div
          class="message-bubble__content"
          :class="message.isOwner ? 'message-bubble__content--owner' : 'message-bubble__content--guest'"
        >
          {{ message.content }}
        </div>
        <div
          class="message-bubble__actions"
          :class="{ 'message-bubble__actions--left': message.isOwner }"
        >
          <CommonTooltip content="复制">
            <button type="button" class="message-bubble__action" @click="copyContent">
              <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="13" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="点赞">
            <button
              type="button"
              class="message-bubble__action"
              :class="{ 'message-bubble__action--liked': liked }"
              @click="toggleLike"
            >
              <Icon :name="liked ? 'lucide:heart' : 'lucide:heart'" size="13" />
            </button>
          </CommonTooltip>
        </div>
      </div>
      <div
        v-if="message.browser || message.region"
        class="message-bubble__foot"
        :class="{ 'message-bubble__foot--end': message.isOwner }"
      >
        <span
          v-if="message.browser"
          class="message-bubble__browser"
        >
          <Icon
            name="lucide:monitor"
            size="12"
            class="message-bubble__browser-icon"
          />
          {{ message.browser }}
        </span>
        <template v-if="message.browser && message.region">
          <span class="message-bubble__dot">·</span>
        </template>
        <span
          v-if="message.region"
          class="message-bubble__region"
        >
          <Icon
            name="lucide:map-pin"
            size="12"
            class="message-bubble__region-icon"
          />
          {{ message.region }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

const props = defineProps<{
  message: GuestMessage
}>()

const copied = ref(false)
const liked = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function copyContent() {
  navigator.clipboard.writeText(props.message.content)
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = false }, 1500)
}

function toggleLike() {
  liked.value = !liked.value
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

.message-bubble__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow:
    0 0 0 2px var(--surface-1),
    0 1px 2px rgba(0, 0, 0, 0.05);
}

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
}

:root.dark .message-bubble__owner-badge {
  background: linear-gradient(135deg, #5b7cfa, #7b95ff);
}

.message-bubble__content {
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

.message-bubble__body {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  position: relative;
}

.message-bubble__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;

  /* 默认：操作栏在气泡右侧（访客消息） */
  .message-bubble:hover & {
    opacity: 1;
  }

  /* 博主消息时操作栏放左侧 */
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

  &--liked {
    color: #ef4444;

    &:hover {
      color: #dc2626;
    }
  }
}

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
</style>
