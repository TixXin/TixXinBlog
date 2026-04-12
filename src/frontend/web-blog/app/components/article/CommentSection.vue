<!--
  @file CommentSection.vue
  @description 文章评论区：输入框与评论列表（含嵌套回复）
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="comment-section">
    <h2 class="comment-section__title">
      <Icon name="lucide:message-circle" size="20" />
      评论
      <span class="comment-section__count">({{ comments.length }})</span>
    </h2>

    <div class="comment-section__composer">
      <div class="comment-section__avatar comment-section__avatar--placeholder">
        <Icon name="lucide:user" size="16" />
      </div>
      <div class="comment-section__form">
        <textarea v-model="draft" class="comment-section__textarea" rows="3" placeholder="写下你的评论..." />
        <div class="comment-section__actions">
          <button type="button" class="comment-section__submit" :disabled="!draft.trim()" @click="submitComment">
            发布评论
          </button>
        </div>
      </div>
    </div>

    <ul class="comment-section__list">
      <li v-for="item in comments" :key="item.id" class="comment-section__thread">
        <ArticleCommentBubble :comment="item">
          <ul v-if="item.replies?.length" class="comment-section__replies">
            <li v-for="reply in item.replies" :key="reply.id">
              <ArticleCommentBubble :comment="reply" small />
            </li>
          </ul>
        </ArticleCommentBubble>
      </li>
    </ul>
    <!-- 游客身份弹窗 -->
    <CommonGuestIdentityModal
      :visible="identityModalVisible"
      @confirm="onIdentityConfirm"
      @cancel="identityModalVisible = false"
      @login="onSwitchToLogin"
    />
  </section>
</template>

<script setup lang="ts">
import type { CommentItem } from '~/features/post/types'

defineProps<{
  comments: CommentItem[]
}>()

const emit = defineEmits<{
  submit: [comment: CommentItem]
}>()

const draft = ref('')
const { info } = useToast()
const { isLoggedIn, currentUser } = useCurrentUser()
const { guestIdentity, hasIdentity, resolveAvatar } = useGuestIdentity()
const { open: openLoginDrawer } = useLoginDrawer()

const identityModalVisible = ref(false)
let pendingText = ''

function submitComment() {
  const text = draft.value.trim()
  if (!text) return

  // 已登录 → 用 currentUser 信息
  if (isLoggedIn.value && currentUser.value) {
    emitComment(text, currentUser.value.nickname, currentUser.value.avatar)
    return
  }
  // 未登录 + 有游客身份 → 用游客信息
  if (hasIdentity.value && guestIdentity.value) {
    emitComment(text, guestIdentity.value.nickname, resolveAvatar())
    return
  }
  // 无身份 → 暂存文本，弹出身份面板
  pendingText = text
  identityModalVisible.value = true
}

function emitComment(text: string, author: string, avatar: string) {
  const newComment: CommentItem = {
    id: Date.now(),
    author,
    avatar,
    content: text,
    time: '刚刚',
    likes: 0,
  }
  emit('submit', newComment)
  draft.value = ''
  info('评论发布成功')
}

function onIdentityConfirm() {
  identityModalVisible.value = false
  if (pendingText && hasIdentity.value && guestIdentity.value) {
    emitComment(pendingText, guestIdentity.value.nickname, resolveAvatar())
    pendingText = ''
  }
}

function onSwitchToLogin() {
  identityModalVisible.value = false
  openLoginDrawer('login')
}
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
  justify-content: flex-end;
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
</style>
