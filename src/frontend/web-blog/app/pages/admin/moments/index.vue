<!-- @file index.vue @description 朋友圈管理页面，包含状态筛选、版本化操作与评论审核 -->
<template>
  <section class="admin-moments">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-content.moments.title') }}</h1>
        <p>{{ $t('admin-content.moments.intro') }}</p>
      </div>
      <NuxtLink to="/admin/moments/new">{{ $t('admin-content.moments.create') }}</NuxtLink>
    </header>
    <ClientOnly>
      <template v-if="isLoggedIn">
        <AdminMomentListFilters
          v-model:search="search"
          v-model:topic="topic"
          v-model:date="date"
          v-model:status="status"
          @submit.prevent="applyFilters"
        />
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
          <AdminMomentListItem
            v-for="note in items"
            :key="note.id"
            :note="note"
            :busy="busyIds.includes(note.id)"
            :pending="pending"
            @update="update(note, $event)"
            @comments="showComments(note, $event)"
            @remove="remove(note)"
          />
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
            <AdminMomentCommentItem
              v-for="comment in commentItems"
              :key="comment.id"
              :comment="comment"
              :targeted="commentTargetId === comment.id"
              :busy="busyIds.includes(commentNote.id)"
              @moderate="moderate(comment, $event)"
              @remove="removeComment(comment)"
            />
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
@use '~/assets/styles/admin-moments' as moments;

@include moments.page;
</style>
