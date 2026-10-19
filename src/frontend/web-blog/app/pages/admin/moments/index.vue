<!-- @file index.vue @description 朋友圈管理页面，包含状态筛选、版本化操作与评论审核 -->
<template>
  <section class="admin-moments">
    <header>
      <div>
        <h1>{{ $t('admin-content.moments.title') }}</h1>
        <p>{{ $t('admin-content.moments.intro') }}</p>
      </div>
      <NuxtLink to="/admin/moments/new">{{ $t('admin-content.moments.create') }}</NuxtLink>
    </header>
    <ClientOnly>
      <template v-if="isLoggedIn">
        <form class="admin-moments__filters" @submit.prevent="applyFilters">
          <input
            v-model="search"
            :aria-label="$t('admin-content.moments.searchLabel')"
            maxlength="200"
            :placeholder="$t('admin-content.moments.searchPlaceholder')"
          />
          <input
            v-model="topic"
            :aria-label="$t('admin-content.moments.topicLabel')"
            maxlength="40"
            :placeholder="$t('admin-content.moments.topicPlaceholder')"
          />
          <label
            >{{ $t('admin-content.moments.dateLabel')
            }}<input v-model="date" type="date" :aria-label="$t('admin-content.moments.dateFilterLabel')"
          /></label>
          <select v-model="status" :aria-label="$t('admin-content.moments.statusFilterLabel')">
            <option value="all">{{ $t('admin-content.moments.statusAll') }}</option>
            <option value="published">{{ $t('admin-content.moments.status.published') }}</option>
            <option value="draft">{{ $t('admin-content.moments.status.draft') }}</option>
            <option value="archived">{{ $t('admin-content.moments.status.archived') }}</option>
          </select>
          <button type="submit">{{ $t('admin-content.moments.filter') }}</button>
        </form>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="items.length > 0"
          :title="error || $t('admin-content.moments.loading')"
          @retry="load"
        />
        <p v-if="!pending && !error && !items.length">{{ $t('admin-content.moments.empty') }}</p>
        <CommonRequestFeedback
          v-if="commentsLinkPending || commentsLinkError"
          compact
          :pending="commentsLinkPending"
          :title="commentsLinkError || $t('admin-content.moments.locatingComments')"
          @retry="openLinkedComments"
        />
        <ul class="admin-moments__list">
          <li v-for="note in items" :key="note.id">
            <p>
              {{ $t(`admin-content.moments.status.${note.status}`) }}
              <span v-if="note.isPinned">· {{ $t('admin-content.moments.pinned') }}</span> ·
              {{ note.updatedAt.slice(0, 10) }}
            </p>
            <p class="admin-moments__content">{{ note.content }}</p>
            <p>{{ note.topics?.map((topicName) => '#' + topicName).join(' ') }}</p>
            <div class="admin-moments__actions">
              <NuxtLink :to="`/admin/moments/${note.id}`">{{ $t('admin-content.moments.edit') }}</NuxtLink>
              <NuxtLink v-if="note.status === 'published'" :to="`/moments/${note.id}`">{{
                $t('admin-content.moments.viewPublic')
              }}</NuxtLink>
              <button
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { isPinned: !note.isPinned })"
              >
                {{ note.isPinned ? $t('admin-content.moments.unpin') : $t('admin-content.moments.pin') }}
              </button>
              <button
                v-if="note.status !== 'published'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'published' })"
              >
                {{ $t('admin-content.moments.publish') }}
              </button>
              <button
                v-if="note.status !== 'draft'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'draft' })"
              >
                {{ $t('admin-content.moments.toDraft') }}
              </button>
              <button
                v-if="note.status !== 'archived'"
                type="button"
                :disabled="busyIds.includes(note.id) || pending"
                @click="update(note, { status: 'archived' })"
              >
                {{ $t('admin-content.moments.archive') }}
              </button>
              <button type="button" :disabled="busyIds.includes(note.id)" @click="showComments(note, $event)">
                {{ $t('admin-content.moments.manageComments') }}
              </button>
              <button type="button" :disabled="busyIds.includes(note.id) || pending" @click="remove(note)">
                {{ $t('admin-content.moments.remove') }}
              </button>
            </div>
          </li>
        </ul>
        <nav v-if="total > 15" class="admin-moments__actions" :aria-label="$t('admin-content.moments.pagination')">
          <button type="button" :disabled="page <= 1 || pending" @click="setPage(page - 1)">
            {{ $t('admin-content.moments.prevPage') }}
          </button>
          <span>{{
            $t('admin-content.moments.pageStatus', { page, pages: Math.max(1, Math.ceil(total / 15)), total })
          }}</span>
          <button type="button" :disabled="page * 15 >= total || pending" @click="setPage(page + 1)">
            {{ $t('admin-content.moments.nextPage') }}
          </button>
        </nav>
        <section
          v-if="commentNote"
          ref="commentsPanel"
          tabindex="-1"
          class="admin-moments__comments"
          :aria-label="$t('admin-content.moments.commentsPanel')"
        >
          <h2>{{ $t('admin-content.moments.commentsTitle') }}</h2>
          <p>{{ commentNote.content.slice(0, 160) }}</p>
          <button type="button" @click="hideComments">{{ $t('admin-content.moments.closeComments') }}</button>
          <i18n-t keypath="admin-content.moments.commentPolicy" tag="p" scope="global">
            <template #policy>
              <NuxtLink to="/admin/comments">{{ $t('admin-content.moments.commentPolicyLink') }}</NuxtLink>
            </template>
          </i18n-t>
          <CommonRequestFeedback
            v-if="commentsPending || commentsError"
            compact
            :pending="commentsPending"
            :title="commentsError || $t('admin-content.moments.loadingComments')"
            @retry="openComments(commentNote, commentPage)"
          />
          <p v-if="!commentsPending && !commentsError && !commentItems.length">
            {{ $t('admin-content.moments.noComments') }}
          </p>
          <ul>
            <li
              v-for="comment in commentItems"
              :key="comment.id"
              :data-comment-id="comment.id"
              :data-comment-target="commentTargetId === comment.id"
              :tabindex="commentTargetId === comment.id ? -1 : undefined"
            >
              <strong>{{ comment.author }}{{ comment.isOwner ? $t('admin-content.moments.ownerSuffix') : '' }}</strong
              ><span>
                · {{ $t(`admin-content.moments.commentStatus.${comment.moderationStatus ?? 'published'}`) }}</span
              >
              <p>{{ comment.content }}</p>
              <div class="admin-moments__actions">
                <button
                  v-if="comment.moderationStatus !== 'published'"
                  type="button"
                  :disabled="busyIds.includes(commentNote.id)"
                  @click="moderate(comment, 'published')"
                >
                  {{ $t('admin-content.moments.publishComment') }}
                </button>
                <button
                  v-if="comment.moderationStatus !== 'hidden'"
                  type="button"
                  :disabled="busyIds.includes(commentNote.id)"
                  @click="moderate(comment, 'hidden')"
                >
                  {{ $t('admin-content.moments.hideComment') }}
                </button>
                <button type="button" :disabled="busyIds.includes(commentNote.id)" @click="removeComment(comment)">
                  {{ $t('admin-content.moments.removeComment') }}
                </button>
              </div>
            </li>
          </ul>
          <nav
            v-if="commentTotal > 15"
            class="admin-moments__actions"
            :aria-label="$t('admin-content.moments.commentPagination')"
          >
            <button
              type="button"
              :disabled="commentPage <= 1 || commentsPending"
              @click="openComments(commentNote, commentPage - 1)"
            >
              {{ $t('admin-content.moments.prevCommentPage') }}
            </button>
            <span>{{ commentPage }} / {{ Math.ceil(commentTotal / 15) }}</span>
            <button
              type="button"
              :disabled="commentPage * 15 >= commentTotal || commentsPending"
              @click="openComments(commentNote, commentPage + 1)"
            >
              {{ $t('admin-content.moments.nextCommentPage') }}
            </button>
          </nav>
          <form v-if="commentNote.status === 'published'" @submit.prevent="reply">
            <label
              >{{ $t('admin-content.moments.replyLabel')
              }}<textarea v-model="replyDraft" :aria-label="$t('admin-content.moments.replyAria')" maxlength="1000" />
            </label>
            <button
              :aria-busy="replyPending"
              type="submit"
              :disabled="!replyDraft.trim() || busyIds.includes(commentNote.id)"
            >
              {{ $t('admin-content.moments.sendReply') }}
            </button>
          </form>
          <p v-else>{{ $t('admin-content.moments.replyAfterPublish') }}</p>
        </section>
      </template>
      <p v-else-if="!restoringPending">{{ $t('admin-content.moments.loginRequired') }}</p>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import type { ManagedMoment } from '~/features/moment/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.moments.title'), robots: 'noindex, nofollow' })
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
  replyPending,
  reply,
} = useAdminMoments()
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
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
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
.admin-moments__filters label {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
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
@media (max-width: 600px) {
  .admin-moments__filters > input,
  .admin-moments__filters > select,
  .admin-moments__filters label,
  .admin-moments__filters label input {
    width: 100%;
    max-width: 100%;
  }
}
</style>
