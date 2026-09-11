<!--
  @file flashes.vue
  @description 后台闪念管理，复用闪念编辑器与现有管理员接口。
-->
<template>
  <section class="admin-flashes">
    <header>
      <div>
        <h1>闪念管理</h1>
        <p>记录灵感，管理草稿与公开内容。</p>
      </div>
      <button type="button" :disabled="working || !editorReady" @click="openEditor()">
        <Icon name="lucide:plus" />新建闪念
      </button>
    </header>
    <ClientOnly>
      <form class="admin-flashes__filters" @submit.prevent="resetPage">
        <input v-model="search" aria-label="搜索闪念" placeholder="搜索闪念内容" maxlength="128" /><select
          v-model="status"
          aria-label="闪念状态"
          @change="resetPage"
        >
          <option value="all">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option></select
        ><button type="submit" :disabled="pending">搜索</button>
      </form>
      <p v-if="error" role="alert">
        {{ error }} <button type="button" :disabled="pending || working" @click="retryRead">重新加载</button>
      </p>
      <p v-if="pending" role="status">正在加载闪念…</p>
      <section v-if="editorOpen" ref="editorPanel" tabindex="-1" class="admin-flashes__panel" aria-label="闪念编辑">
        <h2>{{ editing ? '编辑闪念' : '新建闪念' }}</h2>
        <p v-if="editing?.isArchived">保存草稿或发布后将移出归档。</p>
        <p v-if="editorError" role="alert">{{ editorError }}</p>
        <FlashEditor
          :key="editorKey"
          :initial="editing"
          :submitting="working"
          :max-length="50000"
          @submit="save"
          @dirty="dirty = $event"
        />
        <button type="button" :disabled="working" @click="closeEditor">取消编辑</button>
      </section>
      <section
        v-if="commentNote"
        ref="commentsPanel"
        tabindex="-1"
        class="admin-flashes__panel"
        aria-label="闪念评论管理"
      >
        <h2>闪念评论（{{ commentNote.comments.length }}）</h2>
        <p class="admin-flashes__content">{{ commentNote.content }}</p>
        <button type="button" :disabled="working" @click="commentNote = null">关闭评论</button>
        <p v-if="!commentNote.comments.length">暂无评论</p>
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
            ><time>{{ formatDate(comment.createdAt) }}</time>
            <p>{{ comment.content }}</p>
            <button type="button" :disabled="working" @click="removeComment(comment.id)">删除评论</button>
          </li>
        </ul>
      </section>
      <p v-if="!pending && !error && !items.length">当前条件下暂无闪念</p>
      <ul class="admin-flashes__list">
        <li v-for="note in items" :key="note.id">
          <div class="admin-flashes__meta">
            <span>{{ note.isArchived ? '已归档' : note.isDraft ? '草稿' : '已发布' }}</span
            ><span v-if="note.isPinned"><Icon name="lucide:pin" />已置顶</span
            ><time>{{ formatDate(note.updatedAt) }}</time>
          </div>
          <p class="admin-flashes__content">{{ note.content }}</p>
          <p class="admin-flashes__tags">{{ note.tags.map((tag) => `#${tag}`).join(' ') }}</p>
          <div class="admin-flashes__actions">
            <button type="button" :disabled="working || !editorReady" @click="openEditor(note)">编辑</button>
            <button type="button" :disabled="working || pending" @click="update(note, 'pin')">
              {{ note.isPinned ? '取消置顶' : '置顶' }}
            </button>
            <button
              v-if="note.isArchived"
              type="button"
              :disabled="working || pending"
              @click="update(note, 'restore')"
            >
              恢复为草稿
            </button>
            <template v-else
              ><button
                type="button"
                :disabled="working || pending"
                @click="update(note, note.isDraft ? 'publish' : 'withdraw')"
              >
                {{ note.isDraft ? '发布' : '撤回为草稿' }}</button
              ><button type="button" :disabled="working || pending" @click="update(note, 'archive')">
                归档
              </button></template
            >
            <button type="button" :disabled="working" @click="showComments(note)">
              管理评论（{{ note.comments.length }}）
            </button>
            <NuxtLink v-if="!note.isDraft && !note.isArchived" :to="`/flash/${note.id}`">查看公开内容</NuxtLink>
          </div>
        </li>
      </ul>
      <footer>
        <button type="button" :disabled="pending || page <= 1" @click="changePage(page - 1)">上一页</button
        ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 条</span
        ><button type="button" :disabled="pending || page * 20 >= total" @click="changePage(page + 1)">下一页</button>
      </footer>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '闪念管理', robots: 'noindex, nofollow' })
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
function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>
<style scoped lang="scss">
[data-comment-target='true'] {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
h1 {
  font-size: 1.6rem;
  font-weight: 700;
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
button,
input,
select {
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.6rem 0.8rem;
}
button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
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
a {
  color: var(--accent);
}
@media (max-width: 600px) {
  .admin-flashes__filters input {
    width: 100%;
  }
  .admin-flashes__panel,
  .admin-flashes__list > li {
    padding: 1rem;
  }
}
</style>
