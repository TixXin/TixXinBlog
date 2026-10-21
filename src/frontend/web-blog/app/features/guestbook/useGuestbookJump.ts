/**
 * @file useGuestbookJump.ts
 * @description 留言板引用跳转、历史翻页追溯与原位返回流程
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import type { useGuestbookFeed } from '~/composables/useGuestbookFeed'

export function useGuestbookJump(options: {
  messagesWrap: Ref<HTMLElement | null>
  feed: Awaited<ReturnType<typeof useGuestbookFeed>>
  search: Ref<string>
  selectedDate: Ref<string | null>
  pageScope: { signal: AbortSignal }
  onReveal?: () => void
}) {
  const { t } = useI18n()
  const { info: toastInfo } = useToast()

  /** 从哪条回复跳过去，用于“回到回复处” */
  const jumpOrigin = ref<number | null>(null)
  const locating = ref(false)
  let locatedTimer: ReturnType<typeof setTimeout> | null = null

  function findMessage(id: number) {
    return options.messagesWrap.value?.querySelector<HTMLElement>(`[data-guestbook-id="${id}"]`) ?? null
  }

  function revealMessage(node: HTMLElement, instant = false) {
    options.onReveal?.()
    const reduced = instant || matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    node.classList.remove('message-bubble--located')
    void node.offsetWidth
    node.classList.add('message-bubble--located')
    if (locatedTimer) clearTimeout(locatedTimer)
    locatedTimer = setTimeout(() => node.classList.remove('message-bubble--located'), 1700)
  }

  function morePendingSettled() {
    if (!options.feed.morePending.value) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const stop = watch(options.feed.morePending, (busy) => {
        if (busy) return
        stop()
        resolve()
      })
    })
  }

  /** 原留言不在已加载范围时逐页加载更早的历史，最多 20 页，避免无限翻页 */
  async function jumpToMessage({ target, from }: { target: number; from: number }) {
    if (locating.value) return
    let node = findMessage(target)
    const loadedHistory = !node
    if (!node) {
      locating.value = true
      try {
        for (let page = 0; !node && page < 20; page++) {
          await morePendingSettled()
          if (!options.feed.hasMore.value || !options.feed.personalized.value || options.feed.moreError.value) break
          await options.feed.loadMore()
          await nextTick()
          if (options.pageScope.signal.aborted) return
          node = findMessage(target)
        }
      } finally {
        locating.value = false
      }
    }
    if (!node) {
      toastInfo(
        t(
          options.search.value || options.selectedDate.value
            ? 'interaction.guestbook.jumpFiltered'
            : 'interaction.guestbook.jumpHidden',
        ),
      )
      return
    }
    jumpOrigin.value = from
    if (loadedHistory) {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (options.pageScope.signal.aborted) return
    }
    revealMessage(node, loadedHistory)
  }

  function backToOrigin() {
    const node = jumpOrigin.value === null ? null : findMessage(jumpOrigin.value)
    jumpOrigin.value = null
    if (node) revealMessage(node)
  }

  onBeforeUnmount(() => {
    if (locatedTimer) clearTimeout(locatedTimer)
  })

  return {
    jumpOrigin,
    locating,
    jumpToMessage,
    backToOrigin,
    revealMessage,
    findMessage,
  }
}
