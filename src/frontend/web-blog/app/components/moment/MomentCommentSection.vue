<!--
  @file MomentCommentSection.vue
  @description 朋友圈评论区，含头像、折叠展开与输入框
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div class="moment-comments">
    <!-- 评论列表 -->
    <div v-if="comments.length > 0" class="moment-comments__list">
      <div v-for="c in visibleComments" :key="c.id" class="moment-comments__item">
        <MomentUserPopover :profile="c.profile" :is-owner="c.isOwner">
          <div class="moment-comments__avatar">
            <NuxtImg
              v-if="c.avatar"
              :src="c.avatar"
              :alt="c.author"
              width="24"
              height="24"
              class="moment-comments__avatar-img"
              format="webp"
            />
            <Icon v-else name="lucide:user" size="14" class="moment-comments__avatar-fallback" />
          </div>
        </MomentUserPopover>
        <div class="moment-comments__body">
          <span class="moment-comments__author" :class="{ 'is-owner': c.isOwner }">{{ c.author }}</span>
          <span class="moment-comments__sep">：</span>
          <span class="moment-comments__text" v-html="renderMentions(c.content)" />
        </div>
      </div>

      <!-- 展开更多 -->
      <button
        v-if="hasMoreComments && !expanded"
        type="button"
        class="moment-comments__expand"
        @click="expanded = true"
      >
        展开剩余 {{ comments.length - maxVisible }} 条评论
      </button>
    </div>

    <!-- 输入区 -->
    <div class="moment-comments__input-wrap">
      <input
        v-model="draft"
        type="text"
        class="moment-comments__input"
        placeholder="写评论..."
        maxlength="200"
        @keyup.enter="submit"
      >
      <button
        type="button"
        class="moment-comments__send"
        :disabled="!draft.trim()"
        aria-label="发送评论"
        @click="submit"
      >
        <Icon name="lucide:send" size="14" />
      </button>
    </div>

    <!-- 游客身份弹窗：内置于组件，不需层层冒泡 -->
    <CommonGuestIdentityModal
      :visible="identityModalVisible"
      @confirm="onIdentityConfirm"
      @cancel="identityModalVisible = false"
      @login="onSwitchToLogin"
    />
  </div>
</template>

<script setup lang="ts">
import type { MomentCommentItem } from '~/features/moment/types'

const props = defineProps<{
  comments: MomentCommentItem[]
}>()

const emit = defineEmits<{
  submit: [comment: MomentCommentItem]
}>()

const maxVisible = 3
const expanded = ref(false)

const hasMoreComments = computed(() => props.comments.length > maxVisible)
const visibleComments = computed(() => (expanded.value ? props.comments : props.comments.slice(0, maxVisible)))

/** 将评论文本中的 @xxx 转换为高亮 span */
function renderMentions(text: string): string {
  return text.replace(/@(\S+)/g, '<span class="mention">@$1</span>')
}

const draft = ref('')
const identityModalVisible = ref(false)
let pendingText = ''

const { isLoggedIn, currentUser } = useCurrentUser()
const { guestIdentity, hasIdentity, resolveAvatar } = useGuestIdentity()
const { open: openLoginDrawer } = useLoginDrawer()

function submit() {
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
  const comment: MomentCommentItem = {
    id: `c-${Date.now()}`,
    author,
    avatar,
    content: text,
    time: '刚刚',
    isOwner: false,
  }
  emit('submit', comment)
  draft.value = ''
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
.moment-comments {
  background: var(--surface-2);
  border-radius: $radius-md;
  padding: 0.75rem;
  margin-top: 0.5rem;
  position: relative;

  // 三角指示器
  &::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 1.25rem;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid var(--surface-2);
  }
}

.moment-comments__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.moment-comments__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.moment-comments__avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  margin-top: 1px;
}

.moment-comments__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-comments__avatar-fallback {
  opacity: 0.6;
}

.moment-comments__body {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.moment-comments__author {
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;

  &.is-owner {
    color: var(--danger);
  }
}

.moment-comments__sep {
  color: var(--text-soft);
}

.moment-comments__text {
  color: var(--text-main);

  :deep(.mention) {
    color: var(--accent);
    font-weight: 500;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.moment-comments__expand {
  display: block;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0;
  margin-left: 2rem;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.75;
  }
}

.moment-comments__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--border-soft);
  padding-top: 0.625rem;
}

.moment-comments__input {
  flex: 1;
  min-width: 0;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus {
    border-color: var(--accent);
  }
}

.moment-comments__send {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: $radius-sm;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.85;
  }
}
</style>
