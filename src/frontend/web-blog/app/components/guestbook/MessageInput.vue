<!--
  @file MessageInput.vue
  @description 留言输入区：访客身份栏、回复引用预览、textarea 自适应高度、发送按钮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="card message-input">
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
    </div>

    <!-- 游客身份弹窗 -->
    <CommonGuestIdentityModal
      :visible="identityModalVisible"
      @confirm="onIdentityConfirm"
      @cancel="identityModalVisible = false"
      @login="onSwitchToLogin"
    />

    <!-- 底部工具栏 -->
    <div class="message-input__footer">
      <div class="message-input__toolbar" role="toolbar" aria-label="格式工具栏（占位）">
        <CommonTooltip v-for="btn in toolbarButtons" :key="btn.icon" :content="btn.title">
          <button type="button" class="message-input__tool" :aria-label="btn.title">
            <Icon :name="btn.icon" size="15" />
          </button>
        </CommonTooltip>
      </div>
      <button type="button" class="message-input__send" :disabled="!content.trim()" @click="handleAction">
        <Icon name="lucide:send" size="14" />
        <span>发送</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

const props = defineProps<{
  replyTo?: GuestMessage | null
}>()

const emit = defineEmits<{
  /** 发送留言：content + 作者信息 */
  send: [content: string, author: { name: string; avatar: string }]
  cancelReply: []
}>()

const { info } = useToast()
const { guestIdentity, hasIdentity: hasGuestIdentity, resolveAvatar } = useGuestIdentity()
const { isLoggedIn, currentUser } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const identityModalVisible = ref(false)
const MAX_CHARS = 500


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

  // 已登录 → 用 currentUser
  if (isLoggedIn.value && currentUser.value) {
    emitSend(text, currentUser.value.nickname, currentUser.value.avatar)
    return
  }
  // 有游客身份 → 用游客信息
  if (hasGuestIdentity.value && guestIdentity.value) {
    emitSend(text, guestIdentity.value.nickname, resolveAvatar())
    return
  }
  // 无身份 → 弹出身份面板
  identityModalVisible.value = true
}

function emitSend(text: string, name: string, avatar: string) {
  emit('send', text, { name, avatar })
  content.value = ''
  nextTick(autoResize)
  info('留言发送成功')
}

function onIdentityConfirm() {
  identityModalVisible.value = false
  // 身份已保存，重新执行发送
  handleAction()
}

function onSwitchToLogin() {
  identityModalVisible.value = false
  openLoginDrawer('login')
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
  margin: 0.375rem 0.5rem 0.5rem;
  border-radius: $radius-sm;
  border: 1px solid var(--border-soft);
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(8px);
  box-shadow: none;
  padding: 0;
  overflow: hidden;
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
  padding: 0.5rem 0.75rem 0.25rem;
}

.message-input__editor {
  width: 100%;
  min-height: 44px;
  max-height: 160px;
  padding: 0.375rem 0;
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

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}

</style>
