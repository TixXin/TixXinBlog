<!--
  @file FlashNoteCard.vue
  @description 闪念笔记卡片：Blinko 风格 — 内容 + 标签 + 操作栏（点赞 / 评论 / 复制 / 删除）+ 评论区
  @author TixXin
  @since 2026-04-11
-->

<template>
  <article
    :id="'flash-note-' + note.id"
    class="fnc"
    :class="{ 'fnc--cited': cited, 'fnc--commenting': commentOpen, 'fnc--highlighted': highlighted }"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="fnc__content" v-html="renderedContent" />

    <div v-if="note.tags.length > 0" class="fnc__tags">
      <span v-for="t in note.tags" :key="t" class="fnc__tag" @click="$emit('tag-click', t)">#{{ t }}</span>
    </div>

    <footer class="fnc__footer">
      <time class="fnc__time" :datetime="note.createdAt">
        <Icon name="lucide:clock-3" size="11" />
        {{ relativeTime }}
      </time>
      <div class="fnc__actions">
        <button
          type="button"
          class="fnc__action"
          :class="{ 'fnc__action--active': liked }"
          :aria-label="liked ? '取消点赞' : '点赞'"
          @click="$emit('toggle-like', note.id)"
        >
          <Icon :name="liked ? 'lucide:heart' : 'lucide:heart'" size="14" :class="liked ? 'fnc__heart-filled' : ''" />
          <span v-if="note.likes > 0" class="fnc__action-count">{{ note.likes }}</span>
        </button>
        <button
          type="button"
          class="fnc__action"
          :class="{ 'fnc__action--active': commentOpen }"
          aria-label="评论"
          @click="commentOpen = !commentOpen"
        >
          <Icon name="lucide:message-circle" size="14" />
          <span v-if="note.comments.length > 0" class="fnc__action-count">{{ note.comments.length }}</span>
        </button>
        <button type="button" class="fnc__action" aria-label="复制" @click="onCopy">
          <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="14" />
        </button>
        <!-- 删除：内联确认态，3s 超时自动恢复 -->
        <div v-if="confirmingDelete" class="fnc__confirm-delete">
          <span class="fnc__confirm-delete-text">确认删除？</span>
          <button type="button" class="fnc__confirm-yes" @click="confirmDelete">
            <Icon name="lucide:check" size="12" />
          </button>
          <button type="button" class="fnc__confirm-no" @click="cancelDelete">
            <Icon name="lucide:x" size="12" />
          </button>
        </div>
        <button
          v-else-if="!readOnly"
          type="button"
          class="fnc__action fnc__action--danger"
          aria-label="删除"
          @click="startDelete"
        >
          <Icon name="lucide:trash-2" size="14" />
        </button>
      </div>
    </footer>

    <!-- 评论区 -->
    <Transition name="fnc-comments">
      <div v-if="commentOpen" class="fnc__comments">
        <div v-if="note.comments.length > 0" class="fnc__comment-list">
          <div v-for="c in note.comments" :key="c.id" class="fnc__comment">
            <img :src="c.authorAvatar" :alt="c.authorName" class="fnc__comment-avatar" >
            <div class="fnc__comment-body">
              <div class="fnc__comment-head">
                <span class="fnc__comment-name">{{ c.authorName }}</span>
                <span class="fnc__comment-time">{{ formatRelative(c.createdAt) }}</span>
              </div>
              <div class="fnc__comment-text">{{ c.content }}</div>
            </div>
            <button
              v-if="canDeleteComment(c.authorId)"
              type="button"
              class="fnc__comment-remove"
              aria-label="删除评论"
              @click="$emit('remove-comment', { noteId: note.id, commentId: c.id })"
            >
              <Icon name="lucide:x" size="11" />
            </button>
          </div>
        </div>

        <form v-if="!readOnly" class="fnc__comment-form" @submit.prevent="onSubmitComment">
          <input
            v-model.trim="commentDraft"
            type="text"
            class="fnc__comment-input"
            placeholder="写下你的想法…"
            maxlength="200"
          >
          <button
            type="submit"
            class="fnc__comment-send"
            :disabled="!commentDraft"
            aria-label="发送评论"
          >
            <Icon name="lucide:send-horizontal" size="14" />
          </button>
        </form>
        <div v-else-if="note.comments.length === 0" class="fnc__comment-empty">
          还没有评论，登录后留下第一条吧
        </div>
      </div>
    </Transition>
  </article>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'
import { renderFlashMarkdown } from '~/utils/flashMarkdown'

const props = defineProps<{
  note: FlashNote
  cited?: boolean
  readOnly?: boolean
  /** AI 引用高亮：外部控制 2s 脉冲动画 */
  highlighted?: boolean
  /** 当前登录用户 id，用于判断能否删除别人的评论 */
  currentUserId?: string | null
}>()

const emit = defineEmits<{
  remove: [id: string]
  'toggle-like': [id: string]
  'remove-comment': [payload: { noteId: string; commentId: string }]
  'add-comment': [payload: { noteId: string; content: string }]
  'tag-click': [tag: string]
}>()

const { success, error: toastError } = useToast()

const commentOpen = ref(false)
const commentDraft = ref('')
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

// 删除确认态：3s 超时自动恢复
const confirmingDelete = ref(false)
let deleteTimer: ReturnType<typeof setTimeout> | null = null

const liked = computed(() => props.note.likes > 0)
const relativeTime = computed(() => formatRelative(props.note.createdAt))

/** 轻量 markdown 渲染 —— 覆盖编辑器工具栏支持的子集 */
const renderedContent = computed(() => renderFlashMarkdown(props.note.content))

function formatRelative(iso: string): string {
  const created = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - created)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

function canDeleteComment(authorId: string): boolean {
  if (props.readOnly) return false
  return Boolean(props.currentUserId && props.currentUserId === authorId)
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(props.note.content)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 1500)
    success('已复制到剪贴板')
  } catch {
    toastError('复制失败')
  }
}

function startDelete() {
  confirmingDelete.value = true
  deleteTimer = setTimeout(() => {
    confirmingDelete.value = false
  }, 3000)
}

function confirmDelete() {
  if (deleteTimer) clearTimeout(deleteTimer)
  confirmingDelete.value = false
  emit('remove', props.note.id)
}

function cancelDelete() {
  if (deleteTimer) clearTimeout(deleteTimer)
  confirmingDelete.value = false
}

function onSubmitComment() {
  if (!commentDraft.value) return
  emit('add-comment', { noteId: props.note.id, content: commentDraft.value })
  commentDraft.value = ''
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
  if (deleteTimer) clearTimeout(deleteTimer)
})
</script>

<style lang="scss" scoped>
.fnc {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem 1rem 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  break-inside: avoid;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--border);
    box-shadow: var(--shadow-elevated, 0 8px 24px rgba(0, 0, 0, 0.08));

    .fnc__action {
      opacity: 1;
    }
  }

  &--cited {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }

  &--highlighted {
    animation: flash-highlight 2s ease-out;
  }

  &--commenting {
    .fnc__action {
      opacity: 1;
    }
  }
}

.fnc__content {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}

.fnc__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.fnc__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: $radius-full;
  cursor: pointer;
  transition:
    opacity 0.18s,
    background 0.18s;

  &:hover {
    opacity: 0.75;
    background: var(--accent);
    color: #fff;
  }
}

.fnc__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-soft);
}

.fnc__time {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.fnc__actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.fnc__action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  border-radius: $radius-sm;
  cursor: pointer;
  opacity: 0.55;
  transition:
    opacity 0.2s,
    color 0.2s,
    background 0.2s;

  &:hover {
    color: var(--accent);
    background: var(--accent-soft);
  }

  &--active {
    color: var(--accent);
    opacity: 1;
  }

  &--danger:hover {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }
}

.fnc__heart-filled {
  fill: currentColor;
}

.fnc__action-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* ---- 评论区 ---- */
.fnc__comments {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.25rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--border-soft);
}

.fnc__comment-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.fnc__comment {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.fnc__comment-avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: $radius-full;
  object-fit: cover;
}

.fnc__comment-body {
  flex: 1;
  min-width: 0;
}

.fnc__comment-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
}

.fnc__comment-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.fnc__comment-time {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.fnc__comment-text {
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--text-soft);
  word-break: break-word;
}

.fnc__comment-remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
    color: var(--danger);
  }
}

.fnc__comment-empty {
  font-size: 0.6875rem;
  color: var(--text-faint);
  text-align: center;
  padding: 0.5rem 0;
}

.fnc__comment-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem 0.375rem 0.75rem;
  background: var(--surface-2);
  border-radius: $radius-full;
  border: 1px solid var(--border-soft);

  &:focus-within {
    border-color: var(--accent);
  }
}

.fnc__comment-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.75rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.fnc__comment-send {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: $radius-full;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.88;
  }
}

/* ---- Markdown 渲染样式（v-html 内的 class，需 :deep） ---- */
.fnc__content {
  :deep(.fm-code) {
    padding: 0.1rem 0.35rem;
    background: var(--surface-2);
    border-radius: $radius-sm;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
  }

  :deep(.fm-quote) {
    display: block;
    padding-left: 0.75rem;
    border-left: 2px solid var(--accent);
    color: var(--text-soft);
    font-style: italic;
  }

  :deep(.fm-li) {
    display: block;
    padding-left: 0.5rem;

    &::before {
      content: '\2022\00a0';
      color: var(--text-faint);
    }
  }

  :deep(.fm-checkbox) {
    display: block;
    padding-left: 0.25rem;
    color: var(--text-soft);

    &--checked {
      color: var(--accent);
    }
  }
}

/* ---- 删除确认态 ---- */
.fnc__confirm-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  animation: fnc-confirm-in 0.18s ease;
}

.fnc__confirm-delete-text {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--danger);
}

.fnc__confirm-yes,
.fnc__confirm-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  border-radius: $radius-full;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s;
}

.fnc__confirm-yes {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);

  &:hover {
    background: var(--danger);
    color: #fff;
  }
}

.fnc__confirm-no {
  background: var(--surface-2);
  color: var(--text-soft);

  &:hover {
    background: var(--surface-3, var(--surface-2));
    color: var(--text-main);
  }
}

@keyframes fnc-confirm-in {
  from {
    opacity: 0;
    transform: translateX(4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ---- AI 引用高亮脉冲 ---- */
@keyframes flash-highlight {
  0% {
    box-shadow: 0 0 0 3px var(--accent);
  }
  100% {
    box-shadow: 0 0 0 3px transparent;
  }
}

/* 评论区展开 / 收起动画 */
.fnc-comments-enter-active,
.fnc-comments-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.25s ease;
  overflow: hidden;
}

.fnc-comments-enter-from,
.fnc-comments-leave-to {
  opacity: 0;
  max-height: 0;
}

.fnc-comments-enter-to,
.fnc-comments-leave-from {
  opacity: 1;
  max-height: 600px;
}
</style>
