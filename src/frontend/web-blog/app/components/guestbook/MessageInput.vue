<!--
  @file MessageInput.vue
  @description 留言输入区：访客身份栏、悬浮回复引用、textarea 自适应高度、发送按钮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="message-input" :class="{ 'message-input--reply-below': replyPlacement === 'below' }">
    <!-- 引用条脱离文档流，贴在输入卡片外侧，避免撑高后挤压消息列表 -->
    <GuestbookMessageInputReplyBar
      :reply-to="replyTo"
      :placement="replyPlacement"
      @cancel-reply="$emit('cancelReply')"
    />
    <div class="card message-input__panel">
      <CommonSubmissionTrap v-model="website" />
      <p v-if="error" :id="errorId" role="alert" class="message-input__notice">{{ error }}</p>
      <!-- 播报区常驻，只切换内部提示，保证读屏能播报新插入的状态 -->
      <div aria-live="polite">
        <p v-if="notice" role="status" class="message-input__notice">{{ notice }}</p>
      </div>
      <p v-if="storageError" role="alert" class="message-input__notice">{{ storageError }}</p>
      <div
        v-if="hasRecovery"
        class="message-input__notice"
        :aria-label="$t('interaction.guestbookInput.recoveryLabel')"
      >
        {{ $t('interaction.guestbookInput.recoveryFound') }}
        <button type="button" :disabled="submitting" @click="$emit('restore')">
          {{ $t('interaction.guestbookInput.restore') }}
        </button>
        <button type="button" :disabled="submitting" @click="$emit('discard')">
          {{ $t('interaction.guestbookInput.keepCurrent') }}
        </button>
      </div>
      <p v-if="!ready" class="message-input__notice">
        {{ expired ? $t('interaction.guestbookInput.expired') : $t('interaction.guestbookInput.confirmingLogin')
        }}<button v-if="expired" type="button" @click="$emit('login')">
          {{ $t('interaction.guestbookInput.relogin') }}
        </button>
      </p>
      <!-- 拖拽调整高度的手柄（输入区顶部边框） -->
      <div class="message-input__resize-handle" @pointerdown="onResizePointerDown" />

      <!-- 输入区域 -->
      <div class="message-input__editor-wrap">
        <textarea
          ref="textareaRef"
          :value="draft"
          :disabled="!hydrated"
          class="message-input__editor"
          :class="{ 'message-input__editor--resizing': resizing }"
          :style="{ height: editorHeight + 'px' }"
          :placeholder="$t('interaction.guestbookInput.placeholder')"
          :aria-label="$t('interaction.guestbookInput.contentLabel')"
          :aria-invalid="!!error || undefined"
          :aria-describedby="error ? errorId : undefined"
          :maxlength="500"
          @input="$emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
          @keydown="onEditorKeydown"
        />
        <!-- 同宽同样式的隐藏副本，只用来量出正文自然高度，真实输入框的高度才能平滑过渡 -->
        <textarea
          ref="mirrorRef"
          :value="draft"
          class="message-input__editor message-input__editor--mirror"
          aria-hidden="true"
          tabindex="-1"
          readonly
        />
        <!-- 右上角展开/收起按钮 -->
        <CommonTooltip :content="expandLabel">
          <button type="button" class="message-input__expand-toggle" :aria-label="expandLabel" @click="toggleExpand">
            <Icon :name="isExpanded ? 'lucide:minimize-2' : 'lucide:maximize-2'" size="12" />
          </button>
        </CommonTooltip>
      </div>

      <!-- 底部工具栏 -->
      <GuestbookMessageInputFooter
        :identity-label="identityLabel"
        :draft-length="draft.length"
        :submitting="submitting"
        :disabled="!draft.trim() || submitting || !ready"
        @submit="submit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import type { ReplyRef } from '~/features/guestbook/types'
import { useMessageInputResize } from '~/features/guestbook/useMessageInputResize'

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
  /** 聊天模式贴在输入框上方；论坛模式输入框在列表之上，改为向下悬浮以免被页面裁切 */
  replyPlacement?: 'above' | 'below'
}>()

const emit = defineEmits<{
  'update:draft': [value: string]
  send: [fields: VisitorSubmissionFields]
  cancelReply: []
  restore: []
  discard: []
  login: []
}>()

const visitorForm = useVisitorSubmissionForm({ submitting: () => props.submitting, error: () => props.error })
const { website } = visitorForm
// 错误提示与输入框通过 aria-describedby 关联
const errorId = useId()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mirrorRef = ref<HTMLTextAreaElement | null>(null)
const hydrated = ref(false)

// SSR 阶段尚无输入事件监听，挂载后立即开放编辑，不等待登录恢复。
onMounted(() => {
  hydrated.value = true
})

const { editorHeight, resizing, isExpanded, expandLabel, toggleExpand, onResizePointerDown } = useMessageInputResize({
  draft: () => props.draft,
  textareaRef,
  mirrorRef,
})

function submit() {
  if (props.ready && !props.submitting && props.draft.trim()) emit('send', visitorForm.fields())
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
</script>

<style lang="scss" scoped>
.message-input__notice {
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.6;
  padding: 0.5rem 0.75rem 0;
}

.message-input {
  position: relative;
  flex-shrink: 0;
  margin: 0.375rem 0.5rem 0.5rem;
}

.message-input__panel {
  // 与外层卡片同心：外圆角减去 0.5rem 外边距，四角一致
  border-radius: calc(#{$radius-card} - 0.5rem);
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
  cursor: var(--interaction-cursor, ns-resize);
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
  // 随正文自动增高或缩回时平滑过渡；拖拽时跟手，减少动态效果时直接切换
  transition: height 0.24s cubic-bezier(0.22, 0.68, 0.35, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &--resizing {
    transition: none;
  }

  &--mirror {
    position: absolute;
    top: 0;
    left: 0.75rem;
    width: calc(100% - 1.5rem);
    height: 0;
    min-height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  transition:
    color 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉 20px 不变，伪元素把点击区扩到 28px
  &::before {
    content: '';
    position: absolute;
    inset: -4px;
  }

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}
</style>
