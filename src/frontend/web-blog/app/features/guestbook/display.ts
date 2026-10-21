/** @file display.ts @description 留言显示时间与日期分组，统一UTC以保持SSR和跨主题顺序一致 */
import type { ComputedRef, Ref } from 'vue'
import type { DateGroup, GuestbookMetadata, GuestbookRecord, GuestMessage } from './types'
import { displayAvatar } from '~/utils/visitorAvatar'
import { formatDateTime, formatNumber } from '~/utils/format'

/** ownerAvatar 为博主当前头像：单博主站点里博主留言统一用最新头像，不沿用写入时的快照 */
export function guestbookDisplay(note: GuestbookRecord, ownerAvatar?: string): GuestMessage {
  // 跟随界面语言；非法时间 formatDateTime 返回空串
  const time = formatDateTime(note.createdAt, {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return {
    ...note,
    avatar: note.isOwner && ownerAvatar ? ownerAvatar : displayAvatar(note.avatar, note.author, note.isOwner),
    time,
    replyTo: note.replyTo ?? undefined,
  }
}

export function guestbookGroups(notes: GuestbookRecord[], ascending: boolean, ownerAvatar?: string): DateGroup[] {
  const ordered = [...notes].sort(
    (a, b) => (a.createdAt.localeCompare(b.createdAt) || a.id - b.id) * (ascending ? 1 : -1),
  )
  const groups = new Map<string, GuestMessage[]>()
  for (const note of ordered) {
    const date = note.createdAt.slice(0, 10)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(guestbookDisplay(note, ownerAvatar))
  }
  return [...groups].map(([date, messages]) => ({ date, messages }))
}

export function guestbookComposerProps(
  interactions: ReturnType<typeof useGuestbookInteractions>,
  isChatMode: ComputedRef<boolean>,
) {
  return computed(() => ({
    draft: interactions.state.draft,
    replyTo: interactions.state.reply,
    ready: interactions.ready.value,
    expired: interactions.expired.value,
    submitting: interactions.state.submitting,
    error: interactions.state.error,
    notice: interactions.state.notice,
    storageError: interactions.state.storageError,
    hasRecovery: !!interactions.state.recovery,
    identityLabel: interactions.identityLabel.value,
    replyPlacement: (isChatMode.value ? 'above' : 'below') as 'above' | 'below',
  }))
}

export function useGuestbookStats(
  metadata: Ref<GuestbookMetadata | null | undefined>,
  hasMore: Ref<boolean>,
  itemsLength: ComputedRef<number>,
  pending: Ref<boolean>,
  error: Ref<unknown>,
) {
  const { t } = useI18n()
  const messageCountText = computed(() => {
    const count = metadata.value?.stats.messages
    return t('interaction.guestbook.messageCount', { count: count == null ? '—' : formatNumber(count) }, count ?? 2)
  })
  const historyComplete = computed(() => !hasMore.value && itemsLength.value > 0 && !pending.value && !error.value)
  const pinned = computed(() =>
    metadata.value?.pinned ? { ...metadata.value.pinned, time: metadata.value.pinned.createdAt.slice(0, 10) } : null,
  )
  return { messageCountText, historyComplete, pinned }
}
