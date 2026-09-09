<!--
  @file MessageInput.vue
  @description 留言输入区：访客身份栏、回复引用预览、textarea 自适应高度、发送按钮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="card message-input">
    <p class="message-input__notice">{{ identityLabel }} · 最多500字，Ctrl / ⌘ + Enter发送</p>
    <p v-if="error" role="alert" class="message-input__notice">{{ error }}</p>
    <p v-if="notice" role="status" class="message-input__notice">{{ notice }}</p>
    <p v-if="storageError" role="alert" class="message-input__notice">{{ storageError }}</p>
    <div v-if="hasRecovery" class="message-input__notice" aria-label="留言输入恢复">
      发现本标签页未发送的输入。
      <button type="button" :disabled="submitting" @click="$emit('restore')">恢复输入</button>
      <button type="button" :disabled="submitting" @click="$emit('discard')">保留当前输入</button>
    </div>
    <p v-if="!ready" class="message-input__notice">
      {{ expired ? '登录已失效，输入保留。' : '正在确认登录状态…'
      }}<button v-if="expired" type="button" @click="$emit('login')">重新登录</button>
    </p>
    <!-- 回复引用预览 -->
    <Transition name="reply-fade">
      <div v-if="replyTo" class="message-input__reply-bar">
        <Icon name="lucide:reply" size="13" class="message-input__reply-icon" />
        <span class="message-input__reply-label">回复</span>
        <span class="message-input__reply-author">{{ replyTo.author }}</span>
        <span class="message-input__reply-text">{{ replyTo.content }}</span>
        <button type="button" class="message-input__reply-close" aria-label="取消回复" @click="$emit('cancelReply')">
          <Icon name="lucide:x" size="14" />
        </button>
      </div>
    </Transition>

    <!-- 拖拽调整高度的手柄（输入区顶部边框） -->
    <div class="message-input__resize-handle" @pointerdown="onResizePointerDown" />

    <!-- 输入区域 -->
    <div class="message-input__editor-wrap">
      <textarea
        ref="textareaRef"
        :value="draft"
        class="message-input__editor"
        :style="{ height: editorHeight + 'px' }"
        placeholder="输入留言内容..."
        aria-label="留言内容"
        :maxlength="500"
        @input="$emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onEditorKeydown"
      />
      <!-- 右上角展开/收起按钮 -->
      <button
        type="button"
        class="message-input__expand-toggle"
        :title="isExpanded ? '收起输入框' : '展开输入框'"
        @click="toggleExpand"
      >
        <Icon :name="isExpanded ? 'lucide:minimize-2' : 'lucide:maximize-2'" size="12" />
      </button>
    </div>

    <!-- 底部工具栏 -->
    <div class="message-input__footer">
      <small>{{ draft.length }} / 500</small>
      <button
        type="button"
        class="message-input__send"
        :disabled="!draft.trim() || submitting || !ready"
        @click="submit"
      >
        <Icon name="lucide:send" size="14" />
        <span>{{ submitting ? '正在发送…' : '发送留言' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReplyRef } from '~/features/guestbook/types'
const props = defineProps<{
  draft: string
  replyTo?: ReplyRef | null
  ready: boolean
  expired?: boolean
  submitting: boolean
  error?: string
  notice?: string
  storageError?: string
  identityLabel: string
  hasRecovery?: boolean
}>()
const emit = defineEmits<{
  'update:draft': [value: string]
  send: []
  cancelReply: []
  restore: []
  discard: []
  login: []
}>()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editorHeight = ref(72),
  isExpanded = ref(false)
function toggleExpand() {
  isExpanded.value = !isExpanded.value
  editorHeight.value = isExpanded.value ? 144 : 72
}
let resizeStartY = 0,
  resizeStartHeight = 0
function onResizePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  resizeStartY = event.clientY
  resizeStartHeight = editorHeight.value
  window.addEventListener('pointermove', onResizePointerMove)
  window.addEventListener('pointerup', onResizePointerUp, { once: true })
}
function onResizePointerMove(event: PointerEvent) {
  editorHeight.value = Math.max(44, Math.min(320, resizeStartHeight + resizeStartY - event.clientY))
}
function onResizePointerUp() {
  window.removeEventListener('pointermove', onResizePointerMove)
  isExpanded.value = editorHeight.value > 100
}
function submit() {
  if (props.ready && !props.submitting && props.draft.trim()) emit('send')
}
function onEditorKeydown(event: KeyboardEvent) {
  if (!event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    submit()
  }
}
watch(
  () => props.replyTo,
  (value) => {
    if (value) nextTick(() => textareaRef.value?.focus())
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onResizePointerMove)
  window.removeEventListener('pointerup', onResizePointerUp)
})
</script>

<style lang="scss" scoped>
.message-input__notice {
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.6;
  margin-bottom: 0.5rem;
}
.message-input {
  flex-shrink: 0;
  margin: 0.375rem 0.5rem 0.5rem;
  border-radius: $radius-sm $radius-sm $radius-card $radius-card;
  border: 1px solid var(--border-soft);
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(8px);
  box-shadow: none;
  padding: 0;
  overflow: hidden;
}

/* 顶部拖拽手柄：拖动改变输入框高度 */
.message-input__resize-handle {
  height: 6px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: none;
  transition: background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--border-soft);
  }

  &::after {
    content: '';
    width: 2rem;
    height: 2px;
    border-radius: 1px;
    background: var(--border-soft);
    transition: background 0.18s;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  &:hover::after {
    background: var(--text-faint);
  }
}

/* ---- 回复引用预览 ---- */
.message-input__reply-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: color-mix(in srgb, var(--accent, #5b7cfa) 5%, var(--surface-1));
  border-bottom: 1px solid var(--border-soft);
  overflow: hidden;
}

.message-input__reply-icon {
  flex-shrink: 0;
  color: var(--accent, #5b7cfa);
}

.message-input__reply-label {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent, #5b7cfa);
}

.message-input__reply-author {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
}

.message-input__reply-text {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-input__reply-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}

.reply-fade-enter-active {
  transition:
    opacity 0.2s ease,
    max-height 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.reply-fade-leave-active {
  transition:
    opacity 0.15s ease,
    max-height 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.reply-fade-enter-from,
.reply-fade-leave-to {
  opacity: 0;
}

/* ---- 输入区 ---- */
.message-input__editor-wrap {
  position: relative;
  padding: 0.25rem 0.75rem 0.25rem;
}

.message-input__editor {
  width: 100%;
  padding: 0.375rem 1.5rem 0.375rem 0;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  color: var(--text-main);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: auto;

  &::placeholder {
    color: var(--text-faint);
  }
}

/* 右上角展开/收起按钮 */
.message-input__expand-toggle {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

.message-input__send {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: $radius-sm;
  color: #fff;
  background: var(--accent, #5b7cfa);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ---- 底部工具栏 ---- */
.message-input__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.125rem 0.5rem 0.5rem;
}

.message-input__toolbar {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.message-input__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: default;
  transition:
    background 0.15s,
    color 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}
</style>
