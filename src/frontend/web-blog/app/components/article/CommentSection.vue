<!--
  @file CommentSection.vue
  @description 评论表单与列表展示，数据、身份和请求状态由页面传入
-->

<template>
  <section class="comment-section" :aria-label="$t('article.comment.sectionLabel')">
    <!-- 标题行保留常规刷新；读取失败时由下方统一反馈提供唯一重试入口 -->
    <div class="comment-section__head">
      <h2 class="comment-section__title">
        <Icon name="lucide:message-circle" size="20" />
        {{ $t('article.comment.title') }} <span class="comment-section__count">({{ total }})</span>
      </h2>
      <button
        v-if="!loadError"
        ref="refreshButton"
        :aria-busy="loading"
        type="button"
        class="comment-section__refresh"
        :disabled="busy"
        @click="$emit('retry')"
      >
        <Icon name="lucide:refresh-cw" size="14" :class="{ 'is-spinning': loading }" aria-hidden="true" />
        {{ loading ? $t('article.comment.loading') : $t('article.comment.refresh') }}
      </button>
    </div>
    <div class="comment-section__composer">
      <div class="comment-section__avatar comment-section__avatar--placeholder">
        <Icon name="lucide:user" size="16" />
      </div>
      <form class="comment-section__form" @submit.prevent="$emit('submit', visitorForm.fields())">
        <CommonSubmissionTrap v-model="website" />
        <div v-if="replyTarget" class="comment-section__reply-target" role="status">
          {{ $t('article.comment.replyingTo', { author: replyTarget.author }) }}
          <button type="button" :disabled="submitting" @click="$emit('cancel-reply')">
            {{ $t('article.comment.cancelReply') }}
          </button>
        </div>
        <label for="article-comment-draft" class="comment-section__label">{{
          replyTarget ? $t('article.comment.replyContent') : $t('article.comment.commentContent')
        }}</label>
        <textarea
          id="article-comment-draft"
          ref="input"
          v-model="draft"
          class="comment-section__textarea"
          rows="3"
          maxlength="1000"
          :placeholder="$t('article.comment.placeholder')"
          :disabled="submitting || !hydrated"
          :aria-invalid="!!submitError || undefined"
          :aria-describedby="submitError ? 'article-comment-limit article-comment-error' : 'article-comment-limit'"
        />
        <div class="comment-section__actions">
          <span id="article-comment-limit" class="comment-section__limit">{{ draft.length }} / 1000</span>
          <button
            type="submit"
            class="comment-section__submit"
            :disabled="!canSubmit || !hydrated"
            :aria-busy="submitting"
          >
            {{
              submitting
                ? $t('article.comment.submitting')
                : replyTarget
                  ? $t('article.comment.submitReply')
                  : $t('article.comment.submit')
            }}
          </button>
        </div>
        <p v-if="submitError" id="article-comment-error" role="alert" class="comment-section__error">
          {{ submitError }}
        </p>
        <!-- 播报区常驻，只切换内部提示，保证读屏能播报新插入的状态 -->
        <div aria-live="polite">
          <p v-if="submitNotice && !submitError" role="status" class="comment-section__notice">{{ submitNotice }}</p>
        </div>
      </form>
    </div>
    <CommonRequestFeedback
      v-if="loadError"
      ref="loadFeedback"
      :title="$t('article.comment.loadFailedTitle')"
      :description="loadError"
      :pending="busy"
      compact
      @retry="$emit('retry')"
    />
    <p v-if="likeError" role="alert" class="comment-section__error">{{ likeError }}</p>
    <p v-if="!loading && !loadError && !comments.length" class="comment-section__empty">
      {{ $t('article.comment.empty') }}
    </p>
    <ul class="comment-section__list" :aria-busy="loading">
      <li v-for="item in comments" :key="item.id" class="comment-section__thread">
        <ArticleCommentBubble
          :comment="item"
          :busy="busy"
          :pending-likes="pendingLikes"
          @reply="$emit('reply', $event)"
          @like="$emit('like', $event)"
        />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import type { CommentItem } from '~/features/post/types'

const props = defineProps<{
  comments: CommentItem[]
  total: number
  replyTarget: { id: number; author: string } | null
  submitting: boolean
  loading: boolean
  busy: boolean
  canSubmit: boolean
  submitError: string
  submitNotice?: string
  loadError: string
  likeError: string
  pendingLikes: number[]
}>()
const visitorForm = useVisitorSubmissionForm({ submitting: () => props.submitting, error: () => props.submitError })
const { website } = visitorForm
const draft = defineModel<string>({ required: true })
const input = ref<HTMLTextAreaElement | null>(null)
const refreshButton = ref<HTMLButtonElement | null>(null)
const loadFeedback = ref<{ $el: HTMLElement } | null>(null)
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
defineEmits<{
  submit: [fields: VisitorSubmissionFields]
  retry: []
  reply: [comment: CommentItem]
  'cancel-reply': []
  like: [id: number]
}>()
// 刷新按钮与错误态重试按钮互换时保留操作位置，不打断已转到输入框等位置的用户。
watch(
  () => !!props.loadError,
  async (failed) => {
    if (!hydrated.value) return
    const previousButton = failed
      ? refreshButton.value
      : loadFeedback.value?.$el.querySelector<HTMLButtonElement>('button')
    if (!previousButton || document.activeElement !== previousButton) return
    await nextTick()
    if (document.activeElement !== document.body && document.activeElement !== previousButton) return
    const nextButton = failed ? loadFeedback.value?.$el.querySelector<HTMLButtonElement>('button') : refreshButton.value
    nextButton?.focus({ preventScroll: true })
  },
)

watch(
  () => props.replyTarget,
  async (target) => {
    if (target) {
      await nextTick()
      input.value?.focus()
      input.value?.scrollIntoView({
        block: 'center',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
    }
  },
)
</script>

<style lang="scss" scoped>
.comment-section {
  padding: 1.5rem 0 2rem;
  border-top: 1px solid var(--border-soft);
}

.comment-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.comment-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
}

.comment-section__count {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-soft);
}

.comment-section__composer {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.comment-section__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: $radius-full;
  flex-shrink: 0;
  overflow: hidden;

  &--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3);
    color: var(--text-soft);
  }
}

.comment-section__form {
  position: relative;
  flex: 1;
  min-width: 0;
}

.comment-section__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &::placeholder {
    color: var(--text-soft);
  }

  &:focus {
    border-color: var(--focus-ring);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}

.comment-section__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.comment-section__submit {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: $radius-md;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  background: var(--accent);
  color: var(--surface-1);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.92;
  }

  &:disabled {
    opacity: 0.5;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

.comment-section__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comment-section__thread {
  margin: 0;
}

.comment-section__replies {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0 0 0 0.5rem;
  border-left: 2px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.comment-section__limit {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
}
.comment-section__error,
.comment-section__notice {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.comment-section__error {
  color: var(--danger-text);
}
.comment-section__notice {
  color: var(--text-muted);
}
/* 占位文字已说明用途，标签只保留给读屏，头像与输入框顶部对齐 */
.comment-section__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.comment-section__reply-target {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  overflow-wrap: anywhere;
}
.comment-section__reply-target {
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
.comment-section__reply-target button,
.comment-section__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    color: var(--text-main);
    border-color: var(--border-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: var(--interaction-cursor, not-allowed);
  }
}
.comment-section__refresh .is-spinning {
  animation: comment-refresh-spin 0.9s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
@keyframes comment-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}
.comment-section__empty {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
