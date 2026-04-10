<!--
  @file MessageInput.vue
  @description 留言输入区：访客身份栏、回复引用预览、textarea 自适应高度、发送按钮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="card message-input">
    <!-- 访客身份栏 -->
    <div class="message-input__identity">
      <div
        class="message-input__avatar"
        :style="{ background: identity.avatarColor }"
      >
        {{ avatarLetter }}
      </div>
      <input
        v-model="identity.nickname"
        class="message-input__nickname"
        type="text"
        placeholder="你的昵称"
        maxlength="20"
      >
      <div class="message-input__color-picks">
        <button
          v-for="color in avatarColors"
          :key="color"
          type="button"
          class="message-input__color-pick"
          :class="{ 'message-input__color-pick--active': identity.avatarColor === color }"
          :style="{ background: color }"
          :aria-label="`选择颜色 ${color}`"
          @click="identity.avatarColor = color"
        />
      </div>
    </div>

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

    <!-- 输入区域 -->
    <div class="message-input__editor-wrap">
      <textarea
        ref="textareaRef"
        v-model="content"
        class="message-input__editor"
        placeholder="输入留言内容..."
        rows="3"
        :maxlength="MAX_CHARS"
        @input="autoResize"
        @keydown="onEditorKeydown"
      />
      <button type="button" class="message-input__send" :disabled="!content.trim()" @click="handleAction">
        <Icon name="lucide:send" size="15" />
      </button>
    </div>

    <!-- 底部工具栏 -->
    <div class="message-input__footer">
      <div class="message-input__toolbar" role="toolbar" aria-label="格式工具栏（占位）">
        <CommonTooltip v-for="btn in toolbarButtons" :key="btn.icon" :content="btn.title">
          <button type="button" class="message-input__tool" :aria-label="btn.title">
            <Icon :name="btn.icon" size="15" />
          </button>
        </CommonTooltip>
      </div>
      <div class="message-input__footer-right">
        <span class="message-input__hint">
          <kbd class="message-input__kbd">Ctrl</kbd>
          <span class="message-input__kbd-plus">+</span>
          <kbd class="message-input__kbd">Enter</kbd>
          <span class="message-input__hint-text">发送</span>
        </span>
        <span
          class="message-input__char-count"
          :class="{ 'message-input__char-count--warn': charCount > MAX_CHARS * 0.9, 'message-input__char-count--over': charCount > MAX_CHARS }"
        >
          {{ charCount }} / {{ MAX_CHARS }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage, VisitorIdentity } from '~/features/guestbook/types'

const props = defineProps<{
  replyTo?: GuestMessage | null
}>()

const emit = defineEmits<{
  send: [content: string, identity: VisitorIdentity]
  cancelReply: []
}>()

const { info } = useToast()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const MAX_CHARS = 500

/** 可选头像颜色 */
const avatarColors = [
  '#5b7cfa', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

/** 访客身份 */
const identity = reactive<VisitorIdentity>({
  nickname: '',
  avatarColor: avatarColors[0],
})

const avatarLetter = computed(() => {
  const name = identity.nickname.trim()
  return name ? name.charAt(0).toUpperCase() : '?'
})

const charCount = computed(() => content.value.length)

/** textarea 自适应高度 */
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function handleAction() {
  const text = content.value.trim()
  if (!text) {
    info('请输入留言内容')
    return
  }
  if (text.length > MAX_CHARS) {
    info(`留言不能超过 ${MAX_CHARS} 字`)
    return
  }
  emit('send', text, { ...identity })
  content.value = ''
  nextTick(autoResize)
  info('留言发送成功')
}

/** Ctrl/Cmd+Enter 快捷发送 */
function onEditorKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleAction()
  }
}

/** 回复时聚焦输入框 */
watch(() => props.replyTo, (v) => {
  if (v) nextTick(() => textareaRef.value?.focus())
})

const toolbarButtons = [
  { icon: 'lucide:bold', title: '加粗' },
  { icon: 'lucide:italic', title: '斜体' },
  { icon: 'lucide:code', title: '行内代码' },
  { icon: 'lucide:link', title: '链接' },
  { icon: 'lucide:image', title: '图片' },
  { icon: 'lucide:smile', title: '表情' },
] as const
</script>

<style lang="scss" scoped>
.message-input {
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
  border: none;
  border-top: 1px solid var(--border-soft);
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(8px);
  box-shadow: none;
  padding: 0;
  overflow: hidden;
}

/* ---- 访客身份栏 ---- */
.message-input__identity {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.message-input__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  transition: background 0.2s;
}

.message-input__nickname {
  flex: 1;
  min-width: 0;
  height: 1.75rem;
  padding: 0 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  font-size: 0.75rem;
  color: var(--text-main);
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus {
    border-color: var(--border-hover);
  }
}

.message-input__color-picks {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.message-input__color-pick {
  width: 1rem;
  height: 1rem;
  border-radius: $radius-full;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;

  &:hover {
    transform: scale(1.15);
  }

  &--active {
    border-color: var(--text-main);
    box-shadow: 0 0 0 1px var(--surface-1);
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
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}

.reply-fade-enter-active {
  transition: opacity 0.2s ease, max-height 0.2s ease;
}

.reply-fade-leave-active {
  transition: opacity 0.15s ease, max-height 0.15s ease;
}

.reply-fade-enter-from,
.reply-fade-leave-to {
  opacity: 0;
}

/* ---- 输入区 ---- */
.message-input__editor-wrap {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0.5rem;
}

.message-input__editor {
  flex: 1;
  min-height: 44px;
  max-height: 160px;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  outline: none;
  resize: none;
  overflow-y: auto;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus {
    border-color: var(--border-hover);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
}

.message-input__send {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: $radius-md;
  color: #fff;
  background: #1e293b;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s,
    opacity 0.2s;

  &:hover:not(:disabled) {
    background: #0f172a;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

:root.dark .message-input__send {
  background: var(--accent, #5b7cfa);

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
}

/* ---- 底部工具栏 ---- */
.message-input__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem 0.5rem;
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

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}

.message-input__footer-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.message-input__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-faint);
  font-size: 0.625rem;
}

.message-input__kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.125rem;
  min-width: 1.25rem;
  padding: 0 0.25rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface-2);
  font-size: 0.5625rem;
  font-family: inherit;
  color: var(--text-soft);
  line-height: 1;
}

.message-input__kbd-plus {
  color: var(--text-faint);
  font-size: 0.5625rem;
}

.message-input__hint-text {
  margin-left: 0.25rem;
}

.message-input__char-count {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;

  &--warn {
    color: var(--warning, #f59e0b);
  }

  &--over {
    color: var(--danger, #ef4444);
    font-weight: 600;
  }
}
</style>
