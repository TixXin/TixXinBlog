<!--
  @file MessageBubble.vue
  @description 单条留言气泡，按组首尾显示身份与设备地区，保留逐条时间、回复、反应和消息状态
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
      {
        'message-bubble--picker-open': showReactionPicker,
        'message-bubble--actions-open': actionsOpen,
        'message-bubble--continuation': !groupStart,
        'message-bubble--group-end': groupEnd,
      },
    ]"
  >
    <!-- 头像 -->
    <GuestbookMessageBubbleAvatar :message="message" />

    <div class="message-bubble__col" :class="{ 'message-bubble__col--end': message.isOwner }">
      <!-- 用户名和时间 -->
      <GuestbookMessageBubbleMeta :message="message" :author-parts="authorParts" />

      <!-- 回复引用：点击跳到原留言 -->
      <GuestbookMessageBubbleReply :message="message" @jump="$emit('jump', $event)" />

      <p v-if="message.moderationStatus === 'pending'" class="message-bubble__foot">
        {{ $t('interaction.guestbookBubble.pendingReview') }}
      </p>
      <p v-if="reactionError" role="alert" class="message-bubble__foot">{{ reactionError }}</p>

      <!-- 气泡主体 -->
      <div class="message-bubble__body">
        <div
          class="message-bubble__content"
          :class="message.isOwner ? 'message-bubble__content--owner' : 'message-bubble__content--guest'"
          tabindex="0"
          role="group"
          :aria-label="
            $t(
              message.isOwner
                ? 'interaction.guestbookBubble.contentLabelOwner'
                : 'interaction.guestbookBubble.contentLabel',
              { author: message.author, time: message.time },
            )
          "
          @click="onContentTap"
        >
          <!-- 气泡尾巴只在组首显示，后续消息与同侧正文对齐 -->
          <span
            class="message-bubble__tail"
            :class="message.isOwner ? 'message-bubble__tail--owner' : 'message-bubble__tail--guest'"
          />
          <!-- 换行保留只作用在正文上，模板缩进产生的空白不再变成首行缩进 -->
          <span class="message-bubble__text"
            ><template v-for="(part, index) in contentParts" :key="index"
              ><mark v-if="part.match" class="message-bubble__mark">{{ part.text }}</mark
              ><template v-else>{{ part.text }}</template></template
            ></span
          >
        </div>

        <!-- 操作按钮与表情浮层 -->
        <GuestbookMessageBubbleActions
          v-model:picker-open="showReactionPicker"
          :message="message"
          :interactive="interactive"
          :reacting="reacting"
          @reply="$emit('reply', message)"
          @react="sendReaction($event, true)"
        />
      </div>

      <!-- 浏览器、地区与已有反应 -->
      <GuestbookMessageBubbleExtras
        :message="message"
        :reactions="reactions"
        :interactive="interactive"
        :reacting="reacting"
        @toggle-reaction="toggleReaction"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

const props = withDefaults(
  defineProps<{
    message: GuestMessage
    /** 单独使用气泡时默认保留完整身份与设备地区。 */
    groupStart?: boolean
    groupEnd?: boolean
    interactive?: boolean
    reacting?: boolean
    reactionError?: string
    highlight?: string
  }>(),
  { groupStart: true, groupEnd: true, reactionError: undefined, highlight: undefined },
)

const emit = defineEmits<{
  react: [value: { id: number; emoji: string; reacted: boolean; complete?: () => void }]
  reply: [message: GuestMessage]
  jump: [value: { target: number; from: number }]
}>()

/** 按关键词切分正文（忽略大小写），用文本节点渲染而非 v-html，避免注入 */
const contentParts = computed(() => splitHighlight(props.message.content, props.highlight))
const authorParts = computed(() => splitHighlight(props.message.author, props.highlight))

const showReactionPicker = ref(false)

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

const reactions = computed(() => props.message.reactions ?? [])

function sendReaction(emoji: string, reacted: boolean, complete?: () => void) {
  if (!props.interactive || props.reacting || props.message.moderationStatus !== 'published') return
  emit('react', {
    id: props.message.id,
    emoji,
    reacted,
    complete:
      complete ??
      (() => {
        const reactionBtn = rootRef.value?.querySelector<HTMLButtonElement>('[aria-label="添加回应"]')
        if (document.activeElement === document.body) reactionBtn?.focus({ preventScroll: true })
      }),
  })
}

function toggleReaction(emoji: string) {
  sendReaction(emoji, !reactions.value.find((item) => item.emoji === emoji)?.reacted)
}

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsideTap, true)
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

// 仅聊天视图合并身份与设备地区；头像槽保留占位，论坛模式仍显示每条完整信息。
[data-display-mode='chat'] .message-bubble {
  &--continuation {
    :deep(.message-bubble__avatar-wrap) {
      visibility: hidden;
      pointer-events: none;
    }

    :deep(.message-bubble__meta),
    .message-bubble__tail {
      display: none;
    }
  }

  &:not(.message-bubble--group-end) {
    :deep(.message-bubble__foot--inline),
    :deep(.message-bubble__extras--metadata-only) {
      display: none;
    }
  }
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

// 实色浅黄配深色字，在浅色、深色气泡与暗色模式下都保持对比度
.message-bubble__mark {
  padding: 0 0.125rem;
  border-radius: 0.1875rem;
  color: #1e293b;
  background: #fde68a;
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

  &:focus-visible {
    outline: 2px solid var(--accent, #5b7cfa);
    outline-offset: 2px;
  }

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

.message-bubble__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.375rem;
  font-size: 0.625rem;
  color: var(--text-faint);
  margin-top: 0.125rem;
}
</style>
