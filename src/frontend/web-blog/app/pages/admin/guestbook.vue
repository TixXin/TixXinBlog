<!-- @file guestbook.vue @description 博主留言管理：筛选、回复、审核、置顶和删除，复用真实发送与输入恢复 -->
<template>
  <section class="admin-guestbook">
    <header>
      <h1>留言管理</h1>
      <NuxtLink to="/guestbook">查看公开留言板</NuxtLink>
    </header>
    <ClientOnly>
      <template v-if="isLoggedIn">
        <form class="admin-guestbook__filters" @submit.prevent="apply">
          <input v-model="q" aria-label="搜索管理留言" placeholder="搜索正文或作者" maxlength="200" />
          <select v-model="status" aria-label="留言审核状态">
            <option value="all">全部状态</option>
            <option value="published">已公开</option>
            <option value="pending">待审核</option>
            <option value="hidden">已隐藏</option>
          </select>
          <label><input v-model="unanswered" type="checkbox" />仅待博主回复</label>
          <label>日期 · UTC<input v-model="date" type="date" aria-label="留言日期" /></label
          ><button type="submit">筛选</button>
        </form>
        <p v-if="unanswered">仅显示已公开、未删除且尚无公开博主直接回复的游客根留言；隐藏或删除回复后重新计入。</p>
        <CommonRequestFeedback
          v-if="pending || error"
          :compact="items.length > 0"
          :pending="pending"
          :title="error || '正在读取留言'"
          @retry="load"
        />
        <p v-if="!pending && !error && !items.length">当前条件下暂无留言。</p>
        <ul class="admin-guestbook__list">
          <li v-for="note in items" :key="note.id" :data-admin-guestbook-id="note.id">
            <p>
              <strong>{{ note.author }}</strong
              >{{ note.isOwner ? ' · 博主' : '' }} · {{ labels[note.moderationStatus]
              }}{{ note.isPinned ? ' · 置顶' : '' }} · {{ note.createdAt.slice(0, 16).replace('T', ' ') }} UTC
            </p>
            <p class="admin-guestbook__content">{{ note.content }}</p>
            <p v-if="note.replyTo">引用 {{ note.replyTo.author }}：{{ note.replyTo.content }}</p>
            <div class="admin-guestbook__actions">
              <button type="button" @click="show(note.id)">查看留言</button>
              <button type="button" :disabled="note.moderationStatus !== 'published'" @click="reply(note)">
                回复留言
              </button>
              <button
                v-if="note.moderationStatus !== 'published'"
                type="button"
                :disabled="pending || busy.includes(note.id)"
                @click="change(note, { status: 'published' })"
              >
                公开留言
              </button>
              <button
                v-if="note.moderationStatus !== 'hidden'"
                type="button"
                :disabled="pending || busy.includes(note.id)"
                @click="change(note, { status: 'hidden' })"
              >
                隐藏留言
              </button>
              <button
                type="button"
                :disabled="pending || busy.includes(note.id) || note.moderationStatus !== 'published'"
                @click="change(note, { isPinned: !note.isPinned })"
              >
                {{ note.isPinned ? '取消置顶' : '置顶留言' }}
              </button>
              <button type="button" :disabled="pending || busy.includes(note.id)" @click="change(note, {}, true)">
                删除留言
              </button>
            </div>
          </li>
        </ul>
        <nav v-if="total > 20" class="admin-guestbook__actions" aria-label="管理留言分页">
          <button type="button" :disabled="pending || page <= 1" @click="setPage(page - 1)">上一页留言</button
          ><span>{{ page }} / {{ Math.ceil(total / 20) }}，共 {{ total }} 条</span
          ><button type="button" :disabled="pending || page * 20 >= total" @click="setPage(page + 1)">
            下一页留言
          </button>
        </nav>
        <section
          v-if="selected || detailPending || detailError"
          ref="detailPanel"
          tabindex="-1"
          class="admin-guestbook__detail"
          aria-label="留言详情"
        >
          <h2>留言详情</h2>
          <button type="button" @click="closeDetail">关闭详情</button>
          <CommonRequestFeedback
            v-if="detailPending || detailError"
            compact
            :pending="detailPending"
            :title="detailError || '正在读取留言'"
            @retry="retryDetail"
          />
          <template v-if="selected"
            ><p>{{ selected.author }} · {{ labels[selected.moderationStatus] }} · 版本 {{ selected.revision }}</p>
            <p class="admin-guestbook__content">{{ selected.content }}</p>
            <blockquote v-if="selected.replyTo">
              {{ selected.replyTo.author }}：{{ selected.replyTo.content }}
            </blockquote></template
          >
        </section>
        <section ref="composer" aria-label="博主留言输入">
          <h2>发布或回复留言</h2>
          <GuestbookMessageInput
            v-bind="composerProps"
            @update:draft="interactions.setDraft"
            @send="interactions.submit"
            @cancel-reply="interactions.setReply(null)"
            @restore="interactions.restore"
            @discard="interactions.discardRecovery"
            @login="interactions.openLogin"
          />
        </section>
      </template>
      <p v-else-if="!restoring">请先登录博主账号。</p>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import type { ManagedGuestbookRecord } from '~/features/guestbook/types'
import { guestbookDisplay } from '~/features/guestbook/display'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '留言管理', robots: 'noindex, nofollow' })
const {
  isLoggedIn,
  restoring,
  q,
  status,
  unanswered,
  date,
  page,
  items,
  total,
  pending,
  error,
  busy,
  selected,
  detailPending,
  detailError,
  load,
  focus,
  close,
  apply,
  setPage,
  change,
  retryDetail,
} = useAdminGuestbook()
const interactions = useGuestbookInteractions(async () => {
  await load()
}, 'admin')
const labels = { published: '已公开', pending: '待审核', hidden: '已隐藏' }
const composer = ref<HTMLElement | null>(null),
  detailPanel = ref<HTMLElement | null>(null)
let detailTrigger: HTMLElement | null = null
const composerProps = computed(() => ({
  draft: interactions.state.draft,
  replyTo: interactions.state.reply,
  ready: interactions.ready.value,
  expired: interactions.expired.value,
  submitting: interactions.state.submitting,
  error: interactions.state.error,
  notice: interactions.state.notice,
  storageError: interactions.state.storageError,
  hasRecovery: !!interactions.state.recovery,
  identityLabel: '博主',
}))
async function show(id: number) {
  detailTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await focus(id)
  await nextTick()
  detailPanel.value?.focus({ preventScroll: true })
  detailPanel.value?.scrollIntoView({ block: 'nearest' })
}
function closeDetail() {
  close()
  nextTick(() => {
    if (detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true })
  })
}
function reply(note: ManagedGuestbookRecord) {
  interactions.setReply(guestbookDisplay(note))
  nextTick(() => {
    composer.value?.scrollIntoView({ block: 'nearest' })
    composer.value?.querySelector('textarea')?.focus()
  })
}
onBeforeRouteLeave(() => {
  if (interactions.state.submitting) return false
  if (interactions.state.draft.trim()) {
    interactions.persist()
    return window.confirm('未发送的输入已保留为本标签页恢复副本，确定离开吗？')
  }
  return true
})
</script>
<style scoped lang="scss">
.admin-guestbook {
  min-width: 0;
}
.admin-guestbook header,
.admin-guestbook__filters,
.admin-guestbook__actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.admin-guestbook input,
.admin-guestbook select,
.admin-guestbook button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
  max-width: 100%;
}
.admin-guestbook__list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 1rem;
}
.admin-guestbook__list > li,
.admin-guestbook__detail {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
.admin-guestbook__content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.admin-guestbook p,
.admin-guestbook blockquote {
  overflow-wrap: anywhere;
}
.admin-guestbook :disabled {
  opacity: 0.5;
}
</style>
