<!--
  @file CommentSection.vue
  @description 评论表单与列表展示，数据、身份和请求状态由页面传入
-->

<template>
  <section class="comment-section" aria-label="文章评论">
    <h2 class="comment-section__title">
      <Icon name="lucide:message-circle" size="20" />
      评论 <span class="comment-section__count">({{ total }})</span>
    </h2>
    <div class="comment-section__composer">
      <div class="comment-section__avatar comment-section__avatar--placeholder">
        <Icon name="lucide:user" size="16" />
      </div>
      <form class="comment-section__form" @submit.prevent="$emit('submit')">
        <div v-if="replyTarget" class="comment-section__reply-target" role="status">
          回复 {{ replyTarget.author }}
          <button type="button" :disabled="submitting" @click="$emit('cancel-reply')">取消回复</button>
        </div>
        <label for="article-comment-draft" class="comment-section__label">{{
          replyTarget ? '回复内容' : '评论内容'
        }}</label>
        <textarea
          id="article-comment-draft"
          ref="input"
          v-model="draft"
          class="comment-section__textarea"
          rows="3"
          maxlength="1000"
          placeholder="写下你的评论..."
          :disabled="submitting || !hydrated"
          aria-describedby="article-comment-limit"
        />
        <div class="comment-section__actions">
          <span id="article-comment-limit">{{ draft.length }} / 1000</span>
          <button type="submit" class="comment-section__submit" :disabled="!canSubmit || !hydrated">
            {{ submitting ? '正在发表…' : replyTarget ? '发表回复' : '发布评论' }}
          </button>
        </div>
        <p v-if="submitError" role="alert" class="comment-section__error">{{ submitError }}</p>
        <p v-if="submitNotice && !submitError" role="status">{{ submitNotice }}</p>
      </form>
    </div>
    <p v-if="loadError" role="alert" class="comment-section__error">{{ loadError }}</p>
    <p v-if="likeError" role="alert" class="comment-section__error">{{ likeError }}</p>
    <button type="button" class="comment-section__refresh" :disabled="busy" @click="$emit('retry')">
      {{ loading ? '正在加载评论…' : loadError ? '重试加载评论' : '刷新评论' }}
    </button>
    <p v-if="!loading && !loadError && !comments.length" class="comment-section__empty">暂无评论，来写下第一条吧。</p>
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
const draft = defineModel<string>({ required: true })
const input = ref<HTMLTextAreaElement | null>(null)
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
defineEmits<{
  submit: []
  retry: []
  reply: [comment: CommentItem]
  'cancel-reply': []
  like: [id: number]
}>()
watch(
  () => props.replyTarget,
  async (target) => {
    if (target) {
      await nextTick()
      input.value?.focus()
      input.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  },
)
</script>

<style lang="scss" scoped>
.comment-section {
  padding: 1.5rem 0 2rem;
  border-top: 1px solid var(--border-soft);
}

.comment-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
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
  flex: 1;
  min-width: 0;
  min-width: 0;
}

.comment-section__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-main);
  font-family: $font-family-base;
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
  cursor: pointer;
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
    cursor: not-allowed;
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
.comment-section__error {
  color: var(--text-main);
  overflow-wrap: anywhere;
}
.comment-section__label {
  display: block;
  margin-bottom: 0.5rem;
}
.comment-section__reply-target {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  overflow-wrap: anywhere;
}
.comment-section__reply-target button,
.comment-section__refresh {
  color: var(--accent-text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}
.comment-section__refresh {
  margin-bottom: 1rem;
}
.comment-section__empty {
  color: var(--text-muted);
}
</style>
