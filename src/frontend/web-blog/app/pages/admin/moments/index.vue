<!-- @file index.vue @description 朋友圈管理页面，包含状态筛选、版本化操作与评论审核 -->
<template>
  <section class="admin-moments">
    <header>
      <div>
        <h1>朋友圈管理</h1>
        <p>管理公开动态、草稿、归档及互动。</p>
      </div>
      <NuxtLink to="/admin/moments/new">发布新动态</NuxtLink>
    </header>
    <ClientOnly>
      <template v-if="isLoggedIn">
        <form class="admin-moments__filters" @submit.prevent="applyFilters">
          <input v-model="search" aria-label="搜索动态" maxlength="200" placeholder="搜索内容或地点" />
          <input v-model="topic" aria-label="筛选动态话题" maxlength="40" placeholder="话题" />
          <label>发布日期（UTC）<input v-model="date" type="date" aria-label="筛选动态日期" /></label>
          <select v-model="status" aria-label="筛选动态状态">
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
          <button type="submit">筛选</button>
        </form>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="items.length > 0"
          :title="error || '正在加载动态'"
          @retry="load"
        />
        <p v-if="!pending && !error && !items.length">当前条件下暂无动态。</p>
        <CommonRequestFeedback
          v-if="commentsLinkPending || commentsLinkError"
          compact
          :pending="commentsLinkPending"
          :title="commentsLinkError || '正在定位动态评论'"
          @retry="openLinkedComments"
        />
        <ul class="admin-moments__list">
          <li v-for="note in items" :key="note.id">
            <p>
              {{ statusLabels[note.status] }} <span v-if="note.isPinned">· 已置顶</span> ·
              {{ note.updatedAt.slice(0, 10) }}
            </p>
            <p class="admin-moments__content">{{ note.content }}</p>
            <p>{{ note.topics?.map((topicName) => '#' + topicName).join(' ') }}</p>
            <div class="admin-moments__actions">
              <NuxtLink :to="`/admin/moments/${note.id}`">编辑动态</NuxtLink>
              <NuxtLink v-if="note.status === 'published'" :to="`/moments/${note.id}`">查看公开动态</NuxtLink>
              <button
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { isPinned: !note.isPinned })"
              >
                {{ note.isPinned ? '取消置顶' : '置顶' }}
              </button>
              <button
                v-if="note.status !== 'published'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'published' })"
              >
                发布
              </button>
              <button
                v-if="note.status !== 'draft'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'draft' })"
              >
                转为草稿
              </button>
              <button
                v-if="note.status !== 'archived'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'archived' })"
              >
                归档
              </button>
              <button type="button" :disabled="busyIds.includes(note.id)" @click="showComments(note, $event)">
                管理评论
              </button>
              <button type="button" :disabled="busyIds.includes(note.id) || pending" @click="remove(note)">
                删除动态
              </button>
            </div>
          </li>
        </ul>
        <nav v-if="total > 15" class="admin-moments__actions" aria-label="管理动态分页">
          <button type="button" :disabled="page <= 1 || pending" @click="setPage(page - 1)">上一页</button>
          <span>{{ page }} / {{ Math.max(1, Math.ceil(total / 15)) }}，共 {{ total }} 条</span>
          <button type="button" :disabled="page * 15 >= total || pending" @click="setPage(page + 1)">下一页</button>
        </nav>
        <section
          v-if="commentNote"
          ref="commentsPanel"
          tabindex="-1"
          class="admin-moments__comments"
          aria-label="动态评论管理"
        >
          <h2>动态评论</h2>
          <p>{{ commentNote.content.slice(0, 160) }}</p>
          <button type="button" @click="hideComments">关闭评论管理</button>
          <p>访客评论遵循<NuxtLink to="/admin/comments">站点评论审核策略</NuxtLink>。</p>
          <CommonRequestFeedback
            v-if="commentsPending || commentsError"
            compact
            :pending="commentsPending"
            :title="commentsError || '正在加载评论'"
            @retry="openComments(commentNote, commentPage)"
          />
          <p v-if="!commentsPending && !commentsError && !commentItems.length">暂无评论。</p>
          <ul>
            <li
              v-for="comment in commentItems"
              :key="comment.id"
              :data-comment-id="comment.id"
              :data-comment-target="commentTargetId === comment.id"
              :tabindex="commentTargetId === comment.id ? -1 : undefined"
            >
              <strong>{{ comment.author }}{{ comment.isOwner ? '（博主）' : '' }}</strong
              ><span> · {{ commentLabels[comment.moderationStatus ?? 'published'] }}</span>
              <p>{{ comment.content }}</p>
              <div class="admin-moments__actions">
                <button
                  v-if="comment.moderationStatus !== 'published'"
                  type="button"
                  :disabled="busyIds.includes(commentNote.id)"
                  @click="moderate(comment, 'published')"
                >
                  公开评论
                </button>
                <button
                  v-if="comment.moderationStatus !== 'hidden'"
                  type="button"
                  :disabled="busyIds.includes(commentNote.id)"
                  @click="moderate(comment, 'hidden')"
                >
                  隐藏评论
                </button>
                <button type="button" :disabled="busyIds.includes(commentNote.id)" @click="removeComment(comment)">
                  删除评论
                </button>
              </div>
            </li>
          </ul>
          <nav v-if="commentTotal > 15" class="admin-moments__actions" aria-label="动态评论分页">
            <button
              type="button"
              :disabled="commentPage <= 1 || commentsPending"
              @click="openComments(commentNote, commentPage - 1)"
            >
              上一页评论
            </button>
            <span>{{ commentPage }} / {{ Math.ceil(commentTotal / 15) }}</span>
            <button
              type="button"
              :disabled="commentPage * 15 >= commentTotal || commentsPending"
              @click="openComments(commentNote, commentPage + 1)"
            >
              下一页评论
            </button>
          </nav>
          <form v-if="commentNote.status === 'published'" @submit.prevent="reply">
            <label>博主回复<textarea v-model="replyDraft" aria-label="动态博主回复" maxlength="1000" /></label>
            <button type="submit" :disabled="!replyDraft.trim() || busyIds.includes(commentNote.id)">
              发送博主回复
            </button>
          </form>
          <p v-else>动态公开后可以回复评论。</p>
        </section>
      </template>
      <p v-else-if="!restoringPending">请先登录博主账号。</p>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import type { ManagedMoment } from '~/features/moment/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '朋友圈管理', robots: 'noindex, nofollow' })
const {
  restoringPending,
  isLoggedIn,
  items,
  total,
  pending,
  error,
  search,
  status,
  topic,
  date,
  page,
  busyIds,
  load,
  applyFilters,
  setPage,
  update,
  remove,
  commentNote,
  commentItems,
  commentTotal,
  commentPage,
  commentsPending,
  commentsError,
  commentTargetId,
  commentsLinkError,
  commentsLinkPending,
  commentsFocusVersion,
  openLinkedComments,
  openComments,
  closeComments,
  moderate,
  removeComment,
  replyDraft,
  reply,
} = useAdminMoments()
const statusLabels = { draft: '草稿', published: '已发布', archived: '已归档' }
const commentLabels = { published: '已公开', pending: '待审核', hidden: '已隐藏' }
const commentsPanel = ref<HTMLElement | null>(null)
watch(commentsFocusVersion, async () => {
  await nextTick()
  const target =
    Array.from(commentsPanel.value?.querySelectorAll<HTMLElement>('[data-comment-id]') ?? []).find(
      (item) => item.dataset.commentId === commentTargetId.value,
    ) ?? commentsPanel.value
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'center', behavior: 'instant' })
})
let commentsTrigger: HTMLElement | null = null
async function showComments(note: ManagedMoment, event: Event) {
  commentsTrigger = event.currentTarget as HTMLElement
  const loading = openComments(note)
  await nextTick()
  commentsPanel.value?.focus({ preventScroll: true })
  commentsPanel.value?.scrollIntoView({ block: 'start' })
  await loading
}
async function hideComments() {
  if (!closeComments()) return
  await nextTick()
  if (commentsTrigger?.isConnected) commentsTrigger.focus()
}
</script>
<style scoped lang="scss">
[data-comment-target='true'] {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.admin-moments {
  display: grid;
  gap: 1rem;
}
header,
.admin-moments__actions,
.admin-moments__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}
header {
  justify-content: space-between;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
button,
input,
select,
textarea,
.admin-moments__actions a,
header > a {
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
  min-height: 44px;
  max-width: 100%;
}
button:disabled {
  opacity: 0.5;
}
input,
textarea,
select {
  min-width: 0;
}
textarea {
  display: block;
  width: 100%;
  min-height: 5rem;
}
.admin-moments__filters input {
  max-width: 240px;
}
ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 1rem;
}
li,
.admin-moments__comments {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  background: var(--surface-1);
}
.admin-moments__content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 12rem;
  overflow: auto;
  margin: 0.6rem 0;
}
.admin-moments__comments p {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
