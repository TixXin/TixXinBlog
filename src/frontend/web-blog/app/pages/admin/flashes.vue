<!--
  @file flashes.vue
  @description 后台闪念管理，复用闪念编辑器与现有管理员接口；评论面板标注审核状态，审核入口在闪念评论页。
-->
<template>
  <section class="admin-flashes">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-content.flashes.title') }}</h1>
        <p>{{ $t('admin-content.flashes.intro') }}</p>
      </div>
      <button type="button" :disabled="working || !editorReady" @click="openEditor()">
        <Icon name="lucide:plus" />{{ $t('admin-content.flashes.create') }}
      </button>
    </header>
    <ClientOnly>
      <form class="admin-flashes__filters" @submit.prevent="resetPage">
        <input
          v-model="search"
          :aria-label="$t('admin-content.flashes.searchLabel')"
          :placeholder="$t('admin-content.flashes.searchPlaceholder')"
          maxlength="128"
        /><select v-model="status" :aria-label="$t('admin-content.flashes.statusLabel')" @change="resetPage">
          <option value="all">{{ $t('admin-content.flashes.statusAll') }}</option>
          <option value="published">{{ $t('admin-content.flashes.status.published') }}</option>
          <option value="draft">{{ $t('admin-content.flashes.status.draft') }}</option>
          <option value="archived">{{ $t('admin-content.flashes.status.archived') }}</option></select
        ><button :aria-busy="pending" type="submit" :disabled="pending">
          {{ $t('admin-content.flashes.search') }}
        </button>
      </form>
      <p v-if="error" role="alert">
        {{ error }}
        <button type="button" :disabled="pending || working" @click="retryRead">
          {{ $t('admin-content.flashes.retry') }}
        </button>
      </p>
      <p v-if="pending" role="status">{{ $t('admin-content.flashes.loading') }}</p>
      <section
        v-if="editorOpen"
        ref="editorPanel"
        tabindex="-1"
        class="admin-flashes__panel"
        :aria-label="$t('admin-content.flashes.editorLabel')"
      >
        <h2>{{ editing ? $t('admin-content.flashes.editTitle') : $t('admin-content.flashes.create') }}</h2>
        <p v-if="editing?.isArchived">{{ $t('admin-content.flashes.archivedHint') }}</p>
        <p v-if="editorError" role="alert">{{ editorError }}</p>
        <FlashEditor
          :key="editorKey"
          :initial="editing"
          :submitting="working"
          :max-length="50000"
          @submit="save"
          @dirty="dirty = $event"
        />
        <button type="button" :disabled="working" @click="closeEditor">
          {{ $t('admin-content.flashes.cancelEdit') }}
        </button>
      </section>
      <section
        v-if="commentNote"
        ref="commentsPanel"
        tabindex="-1"
        class="admin-flashes__panel"
        :aria-label="$t('admin-content.flashes.commentsLabel')"
      >
        <h2>{{ $t('admin-content.flashes.commentsTitle', { count: commentNote.comments.length }) }}</h2>
        <p class="admin-flashes__content">{{ commentNote.content }}</p>
        <button type="button" :disabled="working" @click="commentNote = null">
          {{ $t('admin-content.flashes.closeComments') }}
        </button>
        <NuxtLink to="/admin/flash-comments">{{ $t('admin-content.flashes.moderateComments') }}</NuxtLink>
        <p v-if="!commentNote.comments.length">{{ $t('admin-content.flashes.noComments') }}</p>
        <p v-if="commentTargetMessage" role="status">{{ commentTargetMessage }}</p>
        <ul>
          <li
            v-for="comment in commentNote.comments"
            :key="comment.id"
            :data-comment-id="comment.id"
            :data-comment-target="commentTargetId === comment.id"
            :tabindex="commentTargetId === comment.id ? -1 : undefined"
          >
            <strong>{{ comment.authorName }}</strong
            ><time>{{ formatTime(comment.createdAt) }}</time>
            <span> · {{ $t(`admin-content.flashes.commentStatus.${comment.moderationStatus ?? 'published'}`) }}</span>
            <p>{{ comment.content }}</p>
            <button type="button" :disabled="working" @click="removeComment(comment.id)">
              {{ $t('admin-content.flashes.removeComment') }}
            </button>
          </li>
        </ul>
      </section>
      <p v-if="!pending && !error && !items.length">{{ $t('admin-content.flashes.empty') }}</p>
      <ul class="admin-flashes__list">
        <li v-for="note in items" :key="note.id">
          <div class="admin-flashes__meta">
            <span>{{
              note.isArchived
                ? $t('admin-content.flashes.status.archived')
                : note.isDraft
                  ? $t('admin-content.flashes.status.draft')
                  : $t('admin-content.flashes.status.published')
            }}</span
            ><span v-if="note.isPinned"><Icon name="lucide:pin" />{{ $t('admin-content.flashes.pinned') }}</span
            ><time>{{ formatTime(note.updatedAt) }}</time>
          </div>
          <p class="admin-flashes__content">{{ note.content }}</p>
          <p class="admin-flashes__tags">{{ note.tags.map((tag) => `#${tag}`).join(' ') }}</p>
          <div class="admin-flashes__actions">
            <button type="button" :disabled="working || !editorReady" @click="openEditor(note)">
              {{ $t('admin-content.flashes.edit') }}
            </button>
            <button type="button" :disabled="working || pending" @click="update(note, 'pin')">
              {{ note.isPinned ? $t('admin-content.flashes.unpin') : $t('admin-content.flashes.pin') }}
            </button>
            <button
              v-if="note.isArchived"
              type="button"
              :disabled="working || pending"
              @click="update(note, 'restore')"
            >
              {{ $t('admin-content.flashes.restore') }}
            </button>
            <template v-else
              ><button
                type="button"
                :disabled="working || pending"
                @click="update(note, note.isDraft ? 'publish' : 'withdraw')"
              >
                {{ note.isDraft ? $t('admin-content.flashes.publish') : $t('admin-content.flashes.withdraw') }}</button
              ><button type="button" :disabled="working || pending" @click="update(note, 'archive')">
                {{ $t('admin-content.flashes.archive') }}
              </button></template
            >
            <button type="button" :disabled="working" @click="showComments(note)">
              {{ $t('admin-content.flashes.manageComments', { count: note.comments.length }) }}
            </button>
            <NuxtLink v-if="!note.isDraft && !note.isArchived" :to="`/flash/${note.id}`">{{
              $t('admin-content.flashes.viewPublic')
            }}</NuxtLink>
          </div>
        </li>
      </ul>
      <footer>
        <button type="button" :disabled="pending || page <= 1" @click="changePage(page - 1)">
          {{ $t('admin-content.flashes.prevPage') }}</button
        ><span>{{
          $t('admin-content.flashes.pageStatus', { page, pages: Math.max(1, Math.ceil(total / 20)), total })
        }}</span
        ><button type="button" :disabled="pending || page * 20 >= total" @click="changePage(page + 1)">
          {{ $t('admin-content.flashes.nextPage') }}
        </button>
      </footer>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.flashes.title'), robots: 'noindex, nofollow' })
const {
  status,
  search,
  page,
  items,
  total,
  pending,
  working,
  editorReady,
  error,
  editorOpen,
  editing,
  dirty,
  editorKey,
  editorError,
  commentNote,
  commentTargetId,
  commentTargetMessage,
  retryRead,
  resetPage,
  changePage,
  openEditor,
  closeEditor,
  save,
  update,
  showComments,
  removeComment,
} = useAdminFlashes()
const editorPanel = ref<HTMLElement | null>(null)
const commentsPanel = ref<HTMLElement | null>(null)
watch([editorOpen, editorKey], async () => {
  await nextTick()
  editorPanel.value?.focus()
})
watch(commentNote, async () => {
  await nextTick()
  const target =
    Array.from(commentsPanel.value?.querySelectorAll<HTMLElement>('[data-comment-id]') ?? []).find(
      (item) => item.dataset.commentId === commentTargetId.value,
    ) ?? commentsPanel.value
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'center', behavior: 'instant' })
})
function formatTime(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped lang="scss">
.admin-flashes {
  min-width: 0;
  overflow-wrap: anywhere;
}
[data-comment-target='true'] {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
h2 {
  font-size: 1.15rem;
  margin-bottom: 1rem;
}
header,
footer,
.admin-flashes__filters,
.admin-flashes__actions,
.admin-flashes__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
header {
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
header p,
time,
.admin-flashes__tags {
  color: var(--text-muted);
}

.admin-flashes__panel,
.admin-flashes__list > li {
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 1rem;
  padding: 1.25rem;
  margin: 1rem 0;
}
ul {
  padding: 0;
  list-style: none;
}
.admin-flashes__panel li {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}
time {
  font-size: 0.8rem;
}
.admin-flashes__content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 1rem 0;
}
.admin-flashes__list .admin-flashes__content {
  max-height: 14rem;
  overflow: auto;
}
.admin-flashes__actions {
  margin-top: 1rem;
}
a:not(.admin-btn) {
  color: var(--accent);
}
@media (max-width: 600px) {
  .admin-flashes__filters > * {
    width: 100%;
  }
  .admin-flashes__panel,
  .admin-flashes__list > li {
    padding: 1rem;
  }
}
</style>
