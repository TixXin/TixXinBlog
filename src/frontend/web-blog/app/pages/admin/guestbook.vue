<!-- @file guestbook.vue @description 博主留言管理：筛选、回复、审核、置顶和删除（含当前页批量公开、隐藏与删除），复用真实发送与输入恢复 -->
<template>
  <section class="admin-guestbook">
    <header>
      <h1>{{ $t('admin-media.guestbook.title') }}</h1>
      <NuxtLink to="/guestbook">{{ $t('admin-media.guestbook.viewPublic') }}</NuxtLink>
    </header>
    <ClientOnly>
      <template v-if="isLoggedIn">
        <form class="admin-guestbook__filters" @submit.prevent="apply">
          <input
            v-model="q"
            :aria-label="$t('admin-media.guestbook.searchLabel')"
            :placeholder="$t('admin-media.guestbook.searchPlaceholder')"
            maxlength="200"
          />
          <select v-model="status" :aria-label="$t('admin-media.guestbook.statusLabel')">
            <option value="all">{{ $t('admin-media.guestbook.allStatus') }}</option>
            <option value="published">{{ $t('admin-media.guestbook.status.published') }}</option>
            <option value="pending">{{ $t('admin-media.guestbook.status.pending') }}</option>
            <option value="hidden">{{ $t('admin-media.guestbook.status.hidden') }}</option>
          </select>
          <label><input v-model="unanswered" type="checkbox" />{{ $t('admin-media.guestbook.unanswered') }}</label>
          <label
            >{{ $t('admin-media.guestbook.date')
            }}<input v-model="date" type="date" :aria-label="$t('admin-media.guestbook.dateLabel')" /></label
          ><button type="submit">{{ $t('admin-media.guestbook.filter') }}</button>
        </form>
        <p v-if="unanswered">{{ $t('admin-media.guestbook.unansweredHint') }}</p>
        <CommonRequestFeedback
          v-if="pending || error"
          :compact="items.length > 0"
          :pending="pending"
          :title="error || $t('admin-media.guestbook.loading')"
          @retry="load"
        />
        <p v-if="!pending && !error && !items.length">{{ $t('admin-media.guestbook.empty') }}</p>
        <AdminBatchBar
          v-if="items.length"
          :noun="$t('admin-media.guestbook.batchNoun')"
          :count="selection.count.value"
          :page-count="items.length"
          :all-selected="selection.allSelected.value"
          :partially-selected="selection.partiallySelected.value"
          :actions="batchActions"
          :disabled="pending || busy.length > 0"
          :busy="batchBusy"
          @toggle-all="selection.toggleAll"
          @action="(key) => batch(key as 'published' | 'hidden' | 'delete')"
          @clear="selection.clear"
        />
        <ul class="admin-guestbook__list">
          <li
            v-for="note in items"
            :key="note.id"
            :data-admin-guestbook-id="note.id"
            :class="{ 'is-selected': selection.isSelected(note.id) }"
          >
            <label class="admin-guestbook__select"
              ><input
                type="checkbox"
                :checked="selection.isSelected(note.id)"
                :disabled="pending || busy.includes(note.id)"
                :aria-label="
                  $t('admin-media.guestbook.selectLabel', { author: note.author, content: note.content.slice(0, 40) })
                "
                @change="selection.toggle(note.id, ($event.target as HTMLInputElement).checked)"
            /></label>
            <p>
              <strong>{{ note.author }}</strong
              >{{ note.isOwner ? $t('admin-media.guestbook.ownerSuffix') : '' }} ·
              {{ $t(`admin-media.guestbook.status.${note.moderationStatus}`)
              }}{{ note.isPinned ? $t('admin-media.guestbook.pinnedSuffix') : '' }} ·
              {{ $t('admin-media.guestbook.utcTime', { time: note.createdAt.slice(0, 16).replace('T', ' ') }) }}
              <span v-if="note.browser || note.region" class="admin-guestbook__client"
                >· {{ [note.browser, note.region].filter(Boolean).join(' · ') }}</span
              >
            </p>
            <p class="admin-guestbook__content">{{ note.content }}</p>
            <p v-if="note.replyTo">
              {{ $t('admin-media.guestbook.quote', { author: note.replyTo.author, content: note.replyTo.content }) }}
            </p>
            <div class="admin-guestbook__actions">
              <button type="button" @click="show(note.id)">{{ $t('admin-media.guestbook.view') }}</button>
              <button type="button" :disabled="note.moderationStatus !== 'published'" @click="reply(note)">
                {{ $t('admin-media.guestbook.reply') }}
              </button>
              <button
                v-if="note.moderationStatus !== 'published'"
                type="button"
                :disabled="pending || busy.includes(note.id)"
                @click="change(note, { status: 'published' })"
              >
                {{ $t('admin-media.guestbook.publish') }}
              </button>
              <button
                v-if="note.moderationStatus !== 'hidden'"
                type="button"
                :disabled="pending || busy.includes(note.id)"
                @click="change(note, { status: 'hidden' })"
              >
                {{ $t('admin-media.guestbook.hide') }}
              </button>
              <button
                type="button"
                :disabled="pending || busy.includes(note.id) || note.moderationStatus !== 'published'"
                @click="change(note, { isPinned: !note.isPinned })"
              >
                {{ note.isPinned ? $t('admin-media.guestbook.unpin') : $t('admin-media.guestbook.pin') }}
              </button>
              <button type="button" :disabled="pending || busy.includes(note.id)" @click="change(note, {}, true)">
                {{ $t('admin-media.guestbook.remove') }}
              </button>
            </div>
          </li>
        </ul>
        <nav
          v-if="total > 20"
          class="admin-guestbook__actions admin-guestbook__pagination"
          :aria-label="$t('admin-media.guestbook.pagination')"
        >
          <button type="button" :disabled="pending || page <= 1" @click="setPage(page - 1)">
            {{ $t('admin-media.guestbook.prev') }}</button
          ><span>{{ $t('admin-media.guestbook.pageInfo', { page, pages: Math.ceil(total / 20), total }, total) }}</span
          ><button type="button" :disabled="pending || page * 20 >= total" @click="setPage(page + 1)">
            {{ $t('admin-media.guestbook.next') }}
          </button>
        </nav>
        <section
          v-if="selected || detailPending || detailError"
          ref="detailPanel"
          tabindex="-1"
          class="admin-guestbook__detail"
          :aria-label="$t('admin-media.guestbook.detail')"
        >
          <h2>{{ $t('admin-media.guestbook.detail') }}</h2>
          <button type="button" @click="closeDetail">{{ $t('admin-media.guestbook.closeDetail') }}</button>
          <CommonRequestFeedback
            v-if="detailPending || detailError"
            compact
            :pending="detailPending"
            :title="detailError || $t('admin-media.guestbook.loading')"
            @retry="retryDetail"
          />
          <template v-if="selected"
            ><p>
              {{
                $t('admin-media.guestbook.detailMeta', {
                  author: selected.author,
                  status: $t(`admin-media.guestbook.status.${selected.moderationStatus}`),
                  revision: selected.revision,
                })
              }}
            </p>
            <p class="admin-guestbook__content">{{ selected.content }}</p>
            <blockquote v-if="selected.replyTo">
              {{
                $t('admin-media.guestbook.quoteBody', {
                  author: selected.replyTo.author,
                  content: selected.replyTo.content,
                })
              }}
            </blockquote></template
          >
        </section>
        <section ref="composer" :aria-label="$t('admin-media.guestbook.composerLabel')">
          <h2>{{ $t('admin-media.guestbook.composerTitle') }}</h2>
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
      <p v-else-if="!restoring">{{ $t('admin-media.guestbook.loginRequired') }}</p>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import type { ManagedGuestbookRecord } from '~/features/guestbook/types'
import { guestbookDisplay } from '~/features/guestbook/display'
import type { AdminBatchAction } from '~/composables/useAdminBatchSelection'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.guestbook.title'), robots: 'noindex, nofollow' })
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
  selection,
  batchBusy,
  batch,
  retryDetail,
} = useAdminGuestbook()
const batchActions = computed<AdminBatchAction[]>(() => [
  { key: 'published', label: t('admin-media.guestbook.batchPublish'), icon: 'lucide:check' },
  { key: 'hidden', label: t('admin-media.guestbook.batchHide'), icon: 'lucide:eye-off' },
  { key: 'delete', label: t('admin-media.guestbook.batchRemove'), icon: 'lucide:trash-2', danger: true },
])
const interactions = useGuestbookInteractions(async () => {
  await load()
}, 'admin')
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
  identityLabel: t('admin-media.guestbook.owner'),
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
    return window.confirm(t('admin-media.guestbook.leaveConfirm'))
  }
  return true
})
</script>
<style scoped lang="scss">
.admin-guestbook {
  min-width: 0;
  overflow-wrap: anywhere;
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
  min-width: 0;
  box-sizing: border-box;
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
.admin-guestbook__list > li {
  position: relative;
  padding-left: 3rem;
}
.admin-guestbook__list > li.is-selected {
  border-color: var(--accent);
}
.admin-guestbook .admin-guestbook__select {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
.admin-guestbook .admin-guestbook__select input {
  width: 1.1rem;
  height: 1.1rem;
  min-height: 0;
  padding: 0;
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
.admin-guestbook__filters > label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
@media (max-width: 640px) {
  .admin-guestbook__filters > input,
  .admin-guestbook__filters > select,
  .admin-guestbook__filters > label {
    flex: 1 1 100%;
    width: 100%;
  }
  .admin-guestbook__filters input[type='date'] {
    flex: 1 1 100%;
    width: 100%;
  }
  .admin-guestbook blockquote {
    margin-inline: 0;
  }
}
</style>
