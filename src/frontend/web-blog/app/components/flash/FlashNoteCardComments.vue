<!--
  @file FlashNoteCardComments.vue
  @description 闪念笔记卡片评论区：展开过渡、评论列表、审核态与评论提交表单
  @author TixXin
  @since 2026-10-21
-->

<template>
  <Transition name="fnc-comments">
    <div v-if="open" class="fnc__comments">
      <div v-if="comments.length > 0" class="fnc__comment-list">
        <div v-for="c in comments" :key="c.id" class="fnc__comment">
          <img :src="c.authorAvatar" :alt="c.authorName" class="fnc__comment-avatar" />
          <div class="fnc__comment-body">
            <div class="fnc__comment-head">
              <span class="fnc__comment-name">{{ c.authorName }}</span>
              <span class="fnc__comment-time">{{ formatCommentTime(c.createdAt) }}</span>
              <small v-if="c.moderationStatus === 'pending'" class="fnc__comment-status">{{
                canDeleteComment(c.authorId)
                  ? $t('flash-moment.noteCard.commentPending')
                  : $t('flash-moment.noteCard.commentPendingSelf')
              }}</small>
              <small v-else-if="c.moderationStatus === 'hidden'" class="fnc__comment-status">{{
                $t('flash-moment.noteCard.commentHidden')
              }}</small>
            </div>
            <div class="fnc__comment-text">{{ c.content }}</div>
          </div>
          <button
            v-if="canDeleteComment(c.authorId)"
            type="button"
            class="fnc__comment-remove"
            :aria-label="$t('flash-moment.noteCard.deleteComment')"
            @click="$emit('remove-comment', { noteId, commentId: c.id })"
          >
            <Icon name="lucide:x" size="11" />
          </button>
        </div>
      </div>

      <!-- 评论表单：游客和登录用户均可评论 -->
      <form class="fnc__comment-form" @submit.prevent="onSubmitComment">
        <CommonSubmissionTrap v-model="website" />
        <input
          v-model.trim="commentDraft"
          :disabled="!canInteract || commentSending || busy"
          type="text"
          :aria-label="$t('flash-moment.noteCard.commentInput')"
          class="fnc__comment-input"
          :placeholder="$t('flash-moment.noteCard.commentPlaceholder')"
          maxlength="500"
          @keydown.enter="onCommentEnter"
        />
        <button
          :aria-busy="commentSending"
          type="submit"
          class="fnc__comment-send"
          :disabled="!canInteract || !commentDraft || commentSending || busy"
          :aria-label="$t('flash-moment.noteCard.sendComment')"
        >
          <Icon name="lucide:send-horizontal" size="14" />
        </button>
      </form>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { FlashComment, FlashCommentSubmission } from '~/features/flash/types'
import { formatFlashRelative } from '~/features/flash/date'

const props = defineProps<{
  noteId: string
  open: boolean
  comments: FlashComment[]
  canInteract: boolean
  busy?: boolean
  readOnly?: boolean
  currentUserId?: string | null
  renderClock: number
  clockReady: boolean
}>()

const emit = defineEmits<{
  'remove-comment': [payload: { noteId: string; commentId: string }]
  'add-comment': [payload: FlashCommentSubmission]
}>()

const { t } = useI18n()
const commentDraft = ref('')
const visitorForm = useVisitorSubmissionForm({ active: () => props.open })
const { website } = visitorForm
const commentSending = ref(false)

function formatCommentTime(iso: string): string {
  const now = props.clockReady ? Date.now() : props.renderClock
  return formatFlashRelative(iso, now, props.clockReady, t)
}

function canDeleteComment(_authorId: string): boolean {
  return !props.readOnly && !!props.currentUserId
}

function onSubmitComment() {
  const content = commentDraft.value.trim()
  if (!props.canInteract || !content || commentSending.value || props.busy) return
  commentSending.value = true
  emit('add-comment', {
    noteId: props.noteId,
    content,
    ...visitorForm.fields(),
    complete: (saved) => {
      if (saved) {
        if (commentDraft.value.trim() === content) commentDraft.value = ''
        visitorForm.restart()
      }
      commentSending.value = false
    },
  })
}

function onCommentEnter(event: KeyboardEvent) {
  if (event.isComposing) event.preventDefault()
}
</script>

<style lang="scss" scoped>
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

.fnc__comment-status {
  font-size: 0.7rem;
  color: var(--text-muted);
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
  cursor: var(--interaction-cursor, pointer);

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
  background: var(--accent-action);
  color: #fff;
  cursor: var(--interaction-cursor, pointer);
  transition: opacity 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
  }

  &:not(:disabled):hover {
    opacity: 0.88;
  }
}

.fnc-comments-enter-active,
.fnc-comments-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
