/** @file display.ts @description 留言显示时间与日期分组，统一按站点时区以保持SSR和跨主题顺序一致，并与后端“今日留言”口径相同 */
import type { ComputedRef, Ref } from 'vue'
import type { DateGroup, GuestbookMetadata, GuestbookRecord, GuestMessage } from './types'
import { displayAvatar } from '~/utils/visitorAvatar'
import { formatDateTime, formatNumber } from '~/utils/format'
import { DEFAULT_SITE_TIME_ZONE, siteDayKey } from '~/features/site/timeZone'

/** ownerAvatar 为博主当前头像：单博主站点里博主留言统一用最新头像，不沿用写入时的快照 */
export function guestbookDisplay(
  note: GuestbookRecord,
  ownerAvatar?: string,
  timeZone = DEFAULT_SITE_TIME_ZONE,
): GuestMessage {
  // 跟随界面语言；非法时间 formatDateTime 返回空串
  const time = formatDateTime(note.createdAt, {
    timeZone,
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

export function guestbookGroups(
  notes: GuestbookRecord[],
  ascending: boolean,
  ownerAvatar?: string,
  timeZone = DEFAULT_SITE_TIME_ZONE,
): DateGroup[] {
  const ordered = [...notes].sort(
    (a, b) => (a.createdAt.localeCompare(b.createdAt) || a.id - b.id) * (ascending ? 1 : -1),
  )
  const groups = new Map<string, GuestMessage[]>()
  for (const note of ordered) {
    const date = siteDayKey(note.createdAt, timeZone)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(guestbookDisplay(note, ownerAvatar, timeZone))
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
  const timeZone = useSiteTimeZone()
  const pinned = computed(() =>
    metadata.value?.pinned
      ? { ...metadata.value.pinned, time: siteDayKey(metadata.value.pinned.createdAt, timeZone.value) }
      : null,
  )
  return { messageCountText, historyComplete, pinned }
}
