<!--
  @file guestbook.vue
  @description 博主留言管理：筛选、回复、审核、置顶和删除（含当前页批量公开、隐藏与删除），复用真实发送与输入恢复
  @author TixXin
  @since 2026-10-21
-->
<template>
  <section class="admin-guestbook">
    <header class="admin-page-header">
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
            }}<CommonDatePicker v-model="date" :aria-label="$t('admin-media.guestbook.dateLabel')" clearable /></label
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
          :noun="(count: number) => $t('admin-media.guestbook.batchNoun', count)"
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
          <AdminGuestbookItem
            v-for="note in items"
            :key="note.id"
            :note="note"
            :selected="selection.isSelected(note.id)"
            :disabled="pending || busy.includes(note.id)"
            @toggle-select="selection.toggle(note.id, $event)"
            @view="show"
            @reply="reply"
            @change="change"
            @remove="(n) => change(n, {}, true)"
          />
        </ul>
        <AdminModerationPagination
          v-if="total > 20"
          class="admin-guestbook__actions admin-guestbook__pagination"
          :aria-label="$t('admin-media.guestbook.pagination')"
          :page="page"
          :total="total"
          :page-size="20"
          :disabled="pending"
          :prev-label="$t('admin-media.guestbook.prev')"
          :next-label="$t('admin-media.guestbook.next')"
          :summary="$t('admin-media.guestbook.pageInfo', { page, pages: Math.ceil(total / 20), total }, total)"
          @prev="setPage(page - 1)"
          @next="setPage(page + 1)"
        />
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
  .admin-guestbook__filters .date-picker {
    flex: 1 1 100%;
    width: 100%;
  }
  .admin-guestbook blockquote {
    margin-inline: 0;
  }
}
</style>
