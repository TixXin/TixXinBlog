/**
 * @file useGuestbookScroll.ts
 * @description 留言板双布局（聊天/论坛）滚动锚定、触顶/底分页监听与历史重试焦点管理
 * @author TixXin
 * @since 2026-10-21
 */

import type { ComputedRef, Ref } from 'vue'
import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'
import type { useGuestbookFeed } from '~/composables/useGuestbookFeed'

type GuestbookFeedInstance = Awaited<ReturnType<typeof useGuestbookFeed>>

export function useGuestbookScroll(options: {
  isChatMode: ComputedRef<boolean>
  mounted: Ref<boolean>
  feed?: GuestbookFeedInstance | null
  pageScope: { signal: AbortSignal }
}) {
  const feedRef = shallowRef<GuestbookFeedInstance | null>(options.feed ?? null)
  const scrollbar = ref<{ viewport: HTMLElement | null } | null>(null)
  const messagesWrap = ref<HTMLElement | null>(null)
  const topSentinel = ref<HTMLElement | null>(null)
  const bottomSentinel = ref<HTMLElement | null>(null)
  const atBottom = ref(true)
  const retryingMore = ref(false)

  function attachFeed(feed: GuestbookFeedInstance) {
    feedRef.value = feed
    setupObserver()
  }

  let observer: IntersectionObserver | null = null
  let bottomResize: ResizeObserver | null = null
  let followingLatest = false
  let restoreLatest = false
  let lastScrollTop = 0
  let boundScroll: HTMLElement | Window | null = null
  let initialized = false
  let anchor: { id: string; top: number; scroll: number; root: HTMLElement | null } | null = null

  function root() {
    return resolveScrollRoot(scrollbar.value?.viewport ?? null)
  }

  function captureAnchor() {
    if (!options.mounted.value || !initialized || !messagesWrap.value) return
    restoreLatest = options.isChatMode.value && followingLatest
    if (restoreLatest) {
      anchor = null
      return
    }
    const current = root()
    const bounds = current?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight }
    const item = [...messagesWrap.value.querySelectorAll<HTMLElement>('[data-guestbook-id]')].find((node) => {
      const box = node.getBoundingClientRect()
      return box.bottom > Math.max(bounds.top, 0) && box.top < bounds.bottom
    })
    anchor = item
      ? {
          id: item.dataset.guestbookId!,
          top: item.getBoundingClientRect().top,
          scroll: current?.scrollTop ?? scrollY,
          root: current,
        }
      : null
  }

  function restoreAnchor() {
    if (!options.mounted.value || options.pageScope.signal.aborted) return
    if (restoreLatest && options.isChatMode.value) scrollLatest()
    else if (anchor) {
      const item = messagesWrap.value?.querySelector<HTMLElement>(`[data-guestbook-id="${anchor.id}"]`)
      const current = root()
      if (item) {
        const position = current?.scrollTop ?? scrollY
        const userDelta = current === anchor.root ? position - anchor.scroll : 0
        scrollToRoot(current, position + item.getBoundingClientRect().top - anchor.top + userDelta, false)
      }
      anchor = null
    }
    restoreLatest = false
    bindScroll()
    setupObserver()
  }

  function scrollLatest(smooth = false) {
    const current = root()
    followingLatest = true
    scrollToRoot(current, current?.scrollHeight ?? document.documentElement.scrollHeight, smooth)
  }

  function checkBottom() {
    const current = root()
    const position = current?.scrollTop ?? scrollY
    atBottom.value = current
      ? current.scrollHeight - current.scrollTop - current.clientHeight < 80
      : document.documentElement.scrollHeight - scrollY - innerHeight < 80
    if (atBottom.value) followingLatest = true
    else if (position < lastScrollTop - 1) followingLatest = false
    lastScrollTop = position
  }

  function bindScroll() {
    boundScroll?.removeEventListener('scroll', checkBottom)
    bottomResize?.disconnect()
    boundScroll = root() ?? window
    boundScroll.addEventListener('scroll', checkBottom, { passive: true })
    checkBottom()
    bottomResize = new ResizeObserver(() => {
      if (followingLatest && options.isChatMode.value && initialized && !options.pageScope.signal.aborted) {
        scrollLatest()
      }
    })
    const viewport = root()
    const list = messagesWrap.value?.querySelector('.message-list')
    if (viewport) bottomResize.observe(viewport)
    if (list) bottomResize.observe(list)
  }

  function setupObserver() {
    if (!options.mounted.value || !initialized || options.pageScope.signal.aborted) return
    observer?.disconnect()
    const feed = feedRef.value
    if (!feed) return
    const sentinel = options.isChatMode.value ? topSentinel.value : bottomSentinel.value
    if (!sentinel) return
    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          feed.hasMore.value &&
          feed.personalized.value &&
          !feed.pending.value &&
          !feed.morePending.value &&
          !feed.moreError.value
        ) {
          void feed.loadMore()
        }
      },
      { root: root(), rootMargin: options.isChatMode.value ? '120px 0px 0px' : '0px 0px 120px' },
    )
    observer.observe(sentinel)
  }

  function initialize() {
    if (!options.mounted.value || initialized) return
    initialized = true
    if (options.isChatMode.value) scrollLatest()
    bindScroll()
    setupObserver()
  }

  // 原加载按钮被错误反馈替换时，把键盘焦点交给同一历史区域的重试入口。
  watch(
    () => feedRef.value?.moreError.value,
    async (error, previous) => {
      if (!import.meta.client || !error || previous) return
      const sentinel = options.isChatMode.value ? topSentinel.value : bottomSentinel.value
      const trigger = document.activeElement
      if (!(trigger instanceof HTMLElement) || !sentinel?.contains(trigger)) return
      await nextTick()
      if (options.pageScope.signal.aborted || trigger.isConnected || document.activeElement !== document.body) return
      sentinel.querySelector<HTMLButtonElement>('.request-feedback button')?.focus({ preventScroll: true })
    },
  )

  /** 清除错误时保留重试入口；读取完成后把键盘焦点交回可继续浏览的位置。 */
  async function retryHistory() {
    const feed = feedRef.value
    if (!feed || retryingMore.value || feed.pending.value || feed.morePending.value || !feed.personalized.value) return
    const trigger =
      document.activeElement instanceof HTMLElement && document.activeElement.closest('.guestbook-more')
        ? document.activeElement
        : null
    retryingMore.value = true
    try {
      await feed.retryMore()
    } finally {
      const restoreFocus = trigger && document.activeElement === trigger
      captureAnchor()
      retryingMore.value = false
      await nextTick()
      restoreAnchor()
      if (restoreFocus && !trigger.isConnected && !options.pageScope.signal.aborted) {
        const sentinel = options.isChatMode.value ? topSentinel.value : bottomSentinel.value
        const target = sentinel?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? messagesWrap.value
        target?.focus({ preventScroll: true })
      }
    }
  }

  function resetFollowingLatest() {
    followingLatest = false
  }

  onBeforeUnmount(() => {
    observer?.disconnect()
    bottomResize?.disconnect()
    boundScroll?.removeEventListener('scroll', checkBottom)
  })

  return {
    scrollbar,
    messagesWrap,
    topSentinel,
    bottomSentinel,
    atBottom,
    retryingMore,
    root,
    captureAnchor,
    restoreAnchor,
    scrollLatest,
    retryHistory,
    initialize,
    setupObserver,
    resetFollowingLatest,
    attachFeed,
  }
}
