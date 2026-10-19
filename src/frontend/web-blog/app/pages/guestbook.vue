<!-- @file guestbook.vue @description 真实留言页面，聊天/论坛共用游标流、输入状态和侧栏聚合 -->
<template>
  <CommonPageFrame class="main-inner guestbook-page" header-key="guestbook">
    <template #header>
      <div class="main-content__header">
        <div class="page-title">
          <div class="page-title__icon-wrap" aria-hidden="true"><Icon name="lucide:message-circle" size="18" /></div>
          <div class="page-title__text">
            <h1 class="page-title__heading">{{ t('interaction.guestbook.title') }}</h1>
            <!-- 博主在线状态是信息而非操作，跟在留言数后面，操作区只留搜索 -->
            <p class="page-title__sub guestbook-subline">
              <span>{{ messageCountText }}</span>
              <CommonTooltip :content="ownerPresence.signature || ownerPresence.label">
                <span class="guestbook-presence" :class="`guestbook-presence--${ownerPresence.status}`" tabindex="0"
                  ><span class="guestbook-presence__dot" aria-hidden="true" />{{ ownerPresenceText }}</span
                >
              </CommonTooltip>
            </p>
          </div>
        </div>
        <div class="page-actions guestbook-actions">
          <CommonSearchBox
            v-model="search"
            :label="t('interaction.guestbook.searchLabel')"
            :placeholder="t('interaction.guestbook.searchPlaceholder')"
          />
          <button v-if="search || selectedDate" type="button" class="guestbook-clear" @click="clearFilters">
            {{ t('interaction.guestbook.clearFilters') }}
          </button>
          <CommonContextDrawer
            v-if="!rightVisible"
            v-model:open="infoOpen"
            :label="t('interaction.guestbook.infoDrawer')"
            icon="lucide:info"
            ><GuestbookOverview
              :data="metadata"
              :pending="metadataPending"
              :error="metadataError?.message"
              @retry="refreshMetadata()"
          /></CommonContextDrawer>
          <NuxtLink v-if="isLoggedIn" to="/admin/guestbook" class="guestbook-clear">{{
            t('interaction.guestbook.manage')
          }}</NuxtLink>
        </div>
      </div>
    </template>
    <template #default>
      <div class="guestbook-center" :data-display-mode="isChatMode ? 'chat' : 'forum'">
        <template v-if="!isChatMode"
          ><GuestbookMessageInput
            v-bind="composerProps"
            @update:draft="interactions.setDraft"
            @send="interactions.submit"
            @cancel-reply="interactions.setReply(null)"
            @restore="interactions.restore"
            @discard="interactions.discardRecovery"
            @login="interactions.openLogin"
        /></template>
        <div
          ref="messagesWrap"
          class="guestbook-center__messages-wrap"
          :class="{ 'guestbook-center__messages-wrap--reply-pad': !isChatMode && interactions.state.reply }"
          tabindex="-1"
        >
          <div v-if="pending || feedError" class="guestbook-feedback">
            <CommonRequestFeedback
              :compact="items.length > 0"
              :pending="pending"
              :title="feedError?.message || t('interaction.guestbook.loading')"
              :description="items.length ? t('interaction.guestbook.staleDescription') : undefined"
              @retry="refreshFeed()"
            />
          </div>
          <CommonCustomScrollbar
            ref="scrollbar"
            class="guestbook-center__messages"
            viewport-class="guestbook-viewport"
            :show-back-to-top="false"
            primary
            :primary-direction="isChatMode ? 'down' : 'up'"
          >
            <!-- 置顶公告是滚动区首项：初始占自己的位置，聊天模式下吸顶，消息从磨砂底下滑过而不是被截断 -->
            <div v-if="pinned" class="guestbook-pinned" :class="{ 'guestbook-pinned--sticky': isChatMode }">
              <GuestbookPinnedMessage :key="pinned.id" :message="pinned" />
            </div>
            <!-- 聊天模式向上翻历史，到头的提示也放在最上方 -->
            <p v-if="isChatMode && historyComplete" class="guestbook-end guestbook-end--top">
              {{ filterLabel ? t('interaction.guestbook.endMatchedTop') : t('interaction.guestbook.endEarliest') }}
            </p>
            <div v-if="isChatMode && (hasMore || retryingMore)" ref="topSentinel" class="guestbook-more">
              <CommonRequestFeedback
                v-if="moreError || retryingMore"
                compact
                :pending="pending || morePending || retryingMore || !personalized"
                :title="t('interaction.guestbook.historyFailed')"
                :description="moreError"
                @retry="retryHistory()"
              />
              <button
                v-else
                :aria-busy="morePending"
                type="button"
                :disabled="pending || morePending || !personalized"
                @click="loadMore()"
              >
                {{ morePending ? t('interaction.guestbook.loadingHistory') : t('interaction.guestbook.loadHistory') }}
              </button>
            </div>
            <GuestbookMessageSkeleton v-if="pending && !items.length" />
            <GuestbookEmptyState
              v-else-if="!pending && !feedError && !items.length"
              :filter="filterLabel"
              @compose="focusInput"
              @clear="clearFilters"
            />
            <GuestbookMessageList
              :groups="groups"
              :interactive="personalized && !pending"
              :reacting="interactions.reacting.value"
              :reaction-errors="interactions.reactionErrors.value"
              :highlight="search"
              @reply="reply"
              @react="interactions.react"
              @jump="jumpToMessage"
            />
            <div v-if="!isChatMode && (hasMore || retryingMore)" ref="bottomSentinel" class="guestbook-more">
              <CommonRequestFeedback
                v-if="moreError || retryingMore"
                compact
                :pending="pending || morePending || retryingMore || !personalized"
                :title="t('interaction.guestbook.historyFailed')"
                :description="moreError"
                @retry="retryHistory()"
              />
              <button
                v-else
                :aria-busy="morePending"
                type="button"
                :disabled="pending || morePending || !personalized"
                @click="loadMore()"
              >
                {{ morePending ? t('interaction.guestbook.loadingMore') : t('interaction.guestbook.loadMore') }}
              </button>
            </div>
            <p v-if="!isChatMode && historyComplete" class="guestbook-end">
              {{ t('interaction.guestbook.endAll') }}
            </p>
          </CommonCustomScrollbar>
          <!-- 跳转引用时的查找进度与返回入口 -->
          <p v-if="locating" class="guestbook-jump-pill" role="status">
            <Icon name="lucide:loader-2" size="14" class="guestbook-jump-pill__spin" />{{
              t('interaction.guestbook.locating')
            }}
          </p>
          <button v-else-if="jumpOrigin !== null" type="button" class="guestbook-jump-pill" @click="backToOrigin">
            <Icon name="lucide:corner-down-left" size="14" />{{ t('interaction.guestbook.backToOrigin') }}
          </button>
          <button
            v-if="isChatMode && !atBottom"
            type="button"
            class="guestbook-scroll-bottom"
            :aria-label="t('interaction.guestbook.scrollLatest')"
            @click="scrollLatest(true)"
          >
            <Icon name="lucide:arrow-down" size="18" />
          </button>
        </div>
        <template v-if="isChatMode"
          ><GuestbookMessageInput
            v-bind="composerProps"
            @update:draft="interactions.setDraft"
            @send="interactions.submit"
            @cancel-reply="interactions.setReply(null)"
            @restore="interactions.restore"
            @discard="interactions.discardRecovery"
            @login="interactions.openLogin"
        /></template>
      </div>
    </template>
    <template #overlays>
      <CommonGuestIdentityModal
        :visible="interactions.identityVisible.value"
        @confirm="interactions.confirmIdentity"
        @cancel="interactions.identityVisible.value = false"
        @login="interactions.openLogin"
      />
      <ClientOnly
        ><Teleport to="#right-sidebar-target"
          ><SidebarRightSidebar
            ><GuestbookOverview
              :data="metadata"
              :pending="metadataPending"
              :error="metadataError?.message"
              @retry="refreshMetadata()" /></SidebarRightSidebar></Teleport
      ></ClientOnly>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'
import { guestbookGroups } from '~/features/guestbook/display'
import type { GuestMessage, GuestbookRecord } from '~/features/guestbook/types'
const pageScope = usePageRequestScope(),
  route = useRoute(),
  router = useRouter()
const { activeTheme, currentThemeId } = useLayoutTheme()
const { isLoggedIn } = useCurrentUser()
const { ownerPresence } = useSiteInfo()
const { t } = useI18n()
const presenceKeys = {
  online: 'interaction.guestbook.ownerOnline',
  idle: 'interaction.guestbook.ownerIdle',
  busy: 'interaction.guestbook.ownerBusy',
  offline: 'interaction.guestbook.ownerOffline',
} as const
const ownerPresenceText = computed(() => t(presenceKeys[ownerPresence.value.status]))
const internalWidth = useMediaQuery('(min-width:1024px)'),
  nexusRight = useMediaQuery('(min-width:1440px)'),
  auroraRight = useMediaQuery('(min-width:1280px)')
const isChatMode = computed(() => mounted.value && activeTheme.value.capabilities.leftSidebar && internalWidth.value)
const rightVisible = computed(
  () =>
    mounted.value &&
    (currentThemeId.value === 'nexus' ? nexusRight.value : currentThemeId.value === 'aurora' && auroraRight.value),
)
const infoOpen = ref(false),
  mounted = ref(false),
  atBottom = ref(true),
  retryingMore = ref(false)
const scrollbar = ref<{ viewport: HTMLElement | null } | null>(null),
  messagesWrap = ref<HTMLElement | null>(null)
const topSentinel = ref<HTMLElement | null>(null),
  bottomSentinel = ref<HTMLElement | null>(null)
const search = computed({
  get: () => String(route.query.q ?? ''),
  set: (value) => {
    void router.replace({ path: '/guestbook', query: { ...route.query, q: value || undefined } })
  },
})
const selectedDate = computed(() => (typeof route.query.date === 'string' ? route.query.date : null))
const clearFilters = () => router.replace({ path: '/guestbook' })
/** 当前筛选的可读描述，空状态与历史提示据此区分“没找到”和“没有留言” */
const filterLabel = computed(() =>
  [
    search.value && t('interaction.guestbook.filterKeyword', { keyword: search.value }),
    selectedDate.value && t('interaction.guestbook.filterDate', { date: selectedDate.value }),
  ]
    .filter(Boolean)
    .join(t('interaction.guestbook.filterSeparator')),
)
let observer: IntersectionObserver | null = null,
  bottomResize: ResizeObserver | null = null,
  followingLatest = false,
  restoreLatest = false,
  lastScrollTop = 0,
  boundScroll: HTMLElement | Window | null = null,
  initialized = false
let anchor: { id: string; top: number; scroll: number; root: HTMLElement | null } | null = null
function root() {
  return resolveScrollRoot(scrollbar.value?.viewport ?? null)
}
function captureAnchor() {
  if (!mounted.value || !initialized || !messagesWrap.value) return
  restoreLatest = isChatMode.value && followingLatest
  if (restoreLatest) {
    anchor = null
    return
  }
  const current = root(),
    bounds = current?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight }
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
  if (!mounted.value || pageScope.signal.aborted) return
  if (restoreLatest && isChatMode.value) scrollLatest()
  else if (anchor) {
    const item = messagesWrap.value?.querySelector<HTMLElement>(`[data-guestbook-id="${anchor.id}"]`),
      current = root()
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
  // 内容或输入区变高不代表用户离开底部；向上滚动才取消跟随。
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
    if (followingLatest && isChatMode.value && initialized && !pageScope.signal.aborted) scrollLatest()
  })
  const viewport = root(),
    list = messagesWrap.value?.querySelector('.message-list')
  if (viewport) bottomResize.observe(viewport)
  if (list) bottomResize.observe(list)
}
function setupObserver() {
  if (!mounted.value || !initialized || pageScope.signal.aborted) return
  observer?.disconnect()
  const sentinel = isChatMode.value ? topSentinel.value : bottomSentinel.value
  if (!sentinel) return
  observer = new IntersectionObserver(
    (entries) => {
      if (
        entries.some((entry) => entry.isIntersecting) &&
        hasMore.value &&
        personalized.value &&
        !pending.value &&
        !morePending.value &&
        !moreError.value
      )
        void loadMore()
    },
    { root: root(), rootMargin: isChatMode.value ? '120px 0px 0px' : '0px 0px 120px' },
  )
  observer.observe(sentinel)
}
function initialize() {
  if (!mounted.value || initialized || !items.value.length) return
  initialized = true
  if (isChatMode.value) scrollLatest()
  bindScroll()
  setupObserver()
}
const { info: toastInfo } = useToast()
/** 从哪条回复跳过去，用于“回到回复处” */
const jumpOrigin = ref<number | null>(null)
const locating = ref(false)
let locatedTimer: ReturnType<typeof setTimeout> | null = null
function findMessage(id: number) {
  return messagesWrap.value?.querySelector<HTMLElement>(`[data-guestbook-id="${id}"]`) ?? null
}
function revealMessage(node: HTMLElement, instant = false) {
  followingLatest = false
  const reduced = instant || matchMedia('(prefers-reduced-motion: reduce)').matches
  node.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  // 先移除再强制回流，连续跳到同一条时也能重新播放高亮
  node.classList.remove('message-bubble--located')
  void node.offsetWidth
  node.classList.add('message-bubble--located')
  if (locatedTimer) clearTimeout(locatedTimer)
  locatedTimer = setTimeout(() => node.classList.remove('message-bubble--located'), 1700)
}
function morePendingSettled() {
  if (!morePending.value) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const stop = watch(morePending, (busy) => {
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
        if (!hasMore.value || !personalized.value || moreError.value) break
        await loadMore()
        await nextTick()
        if (pageScope.signal.aborted) return
        node = findMessage(target)
      }
    } finally {
      locating.value = false
    }
  }
  if (!node) {
    toastInfo(
      t(search.value || selectedDate.value ? 'interaction.guestbook.jumpFiltered' : 'interaction.guestbook.jumpHidden'),
    )
    return
  }
  jumpOrigin.value = from
  if (loadedHistory) {
    // 新历史插入后列表会先恢复阅读位置，等两帧布局稳定再直接定位，避免平滑滚动被打断
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (pageScope.signal.aborted) return
  }
  revealMessage(node, loadedHistory)
}
function backToOrigin() {
  const node = jumpOrigin.value === null ? null : findMessage(jumpOrigin.value)
  jumpOrigin.value = null
  if (node) revealMessage(node)
}
function focusInput() {
  nextTick(() => document.querySelector<HTMLTextAreaElement>('.message-input__editor')?.focus())
}
function reply(message: GuestMessage) {
  interactions.setReply(message)
  focusInput()
}
let onSent: (record: GuestbookRecord) => Promise<void> = async () => {}
const interactions = useGuestbookInteractions((record) => onSent(record))
const [feed, overview] = await Promise.all([
  useGuestbookFeed({ q: search, date: selectedDate, beforeChange: captureAnchor, afterChange: restoreAnchor }),
  useGuestbookMetadata(),
])
pageScope.assertActive()
const {
  items,
  pending,
  error: feedError,
  morePending,
  moreError,
  hasMore,
  personalized,
  loadMore,
  retryMore,
  refresh: refreshFeed,
} = feed
// 原加载按钮被错误反馈替换时，把键盘焦点交给同一历史区域的重试入口。
watch(moreError, async (error, previous) => {
  if (!import.meta.client || !error || previous) return
  const sentinel = isChatMode.value ? topSentinel.value : bottomSentinel.value
  const trigger = document.activeElement
  if (!(trigger instanceof HTMLElement) || !sentinel?.contains(trigger)) return
  await nextTick()
  if (pageScope.signal.aborted || trigger.isConnected || document.activeElement !== document.body) return
  sentinel.querySelector<HTMLButtonElement>('.request-feedback button')?.focus({ preventScroll: true })
})
/** 清除错误时保留重试入口；读取完成后把键盘焦点交回可继续浏览的位置。 */
async function retryHistory() {
  if (retryingMore.value || pending.value || morePending.value || !personalized.value) return
  const trigger =
    document.activeElement instanceof HTMLElement && document.activeElement.closest('.guestbook-more')
      ? document.activeElement
      : null
  retryingMore.value = true
  try {
    await retryMore()
  } finally {
    const restoreFocus = trigger && document.activeElement === trigger
    // 聊天视图的重试反馈位于消息上方，收起时高度变化会推动可见留言；按收起前的锚点复位。
    captureAnchor()
    retryingMore.value = false
    await nextTick()
    restoreAnchor()
    if (restoreFocus && !trigger.isConnected && !pageScope.signal.aborted) {
      const sentinel = isChatMode.value ? topSentinel.value : bottomSentinel.value
      const target = sentinel?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? messagesWrap.value
      target?.focus({ preventScroll: true })
    }
  }
}
const { data: metadata, pending: metadataPending, error: metadataError, refresh: refreshMetadata } = overview
const messageCountText = computed(() => {
  const count = metadata.value?.stats.messages
  return t('interaction.guestbook.messageCount', { count: count == null ? '—' : formatNumber(count) }, count ?? 2)
})
const historyComplete = computed(() => !hasMore.value && items.value.length > 0 && !pending.value && !feedError.value)
const { settings: siteSettings } = useSiteSettings()
const groups = computed(() => guestbookGroups(items.value, isChatMode.value, siteSettings.value.avatar))
const pinned = computed(() =>
  metadata.value?.pinned ? { ...metadata.value.pinned, time: metadata.value.pinned.createdAt.slice(0, 10) } : null,
)
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
  identityLabel: interactions.identityLabel.value,
  replyPlacement: (isChatMode.value ? 'above' : 'below') as 'above' | 'below',
}))
onSent = async (record) => {
  await Promise.all([feed.settled(), refreshMetadata()])
  await nextTick()
  if (pageScope.signal.aborted) return
  if (items.value.some((item) => item.id === record.id)) {
    if (isChatMode.value) scrollLatest()
    else
      messagesWrap.value
        ?.querySelector<HTMLElement>(`[data-guestbook-id="${record.id}"]`)
        ?.scrollIntoView({ block: 'nearest' })
  }
}
watch([isChatMode, currentThemeId, rightVisible], async () => {
  captureAnchor()
  infoOpen.value = false
  await nextTick()
  restoreAnchor()
})
watch([() => items.value.length, hasMore, personalized], async () => {
  await nextTick()
  initialize()
  setupObserver()
})
onMounted(async () => {
  mounted.value = true
  await nextTick()
  initialize()
})
onBeforeUnmount(() => {
  if (locatedTimer) clearTimeout(locatedTimer)
  observer?.disconnect()
  bottomResize?.disconnect()
  boundScroll?.removeEventListener('scroll', checkBottom)
})
usePageSeo({
  title: () => t('interaction.guestbook.title'),
  description: () => t('interaction.guestbook.seoDescription'),
  type: 'website',
})
</script>
<style scoped lang="scss">
.guestbook-center {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.guestbook-center__messages-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
// 论坛模式引用条向下悬浮，留出同等空隙，避免盖住置顶和首条留言
.guestbook-center__messages-wrap--reply-pad {
  padding-top: 2.5rem;
}
.guestbook-center__messages {
  flex: 1;
  min-height: 0;
}
.guestbook-center :deep(.guestbook-viewport) {
  overflow-anchor: none;
}
.guestbook-pinned {
  padding: 0.75rem 1.25rem 0;
  // 关闭公告后不留空白带
  &:empty {
    display: none;
  }
}
// 滚动视口是吸顶参照；顶部实色带挡住滚上来的消息，底部渐隐过渡到正文。
// 手机论坛模式按页面滚动且顶部有悬浮按钮，保持普通流
.guestbook-pinned--sticky {
  position: sticky;
  top: 0;
  z-index: 4;
  padding-bottom: 0.75rem;
  margin-bottom: -0.75rem;
  background: linear-gradient(to bottom, var(--surface-1) calc(100% - 0.75rem), transparent);
}
.guestbook-subline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}
.guestbook-presence {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  line-height: 1.25rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  white-space: nowrap;
}
.guestbook-presence__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--text-faint);
}
.guestbook-presence--online {
  color: var(--success-text);
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.08);
}
.guestbook-presence--online .guestbook-presence__dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}
.guestbook-presence--idle {
  color: var(--warning-text);
  border-color: color-mix(in srgb, var(--presence-idle) 35%, transparent);
  background: color-mix(in srgb, var(--presence-idle) 10%, transparent);
}
.guestbook-presence--busy {
  color: var(--danger-text);
  border-color: color-mix(in srgb, var(--presence-busy) 35%, transparent);
  background: color-mix(in srgb, var(--presence-busy) 10%, transparent);
}
.guestbook-presence--idle .guestbook-presence__dot {
  background: var(--presence-idle);
}
.guestbook-presence--busy .guestbook-presence__dot {
  background: var(--presence-busy);
}
.guestbook-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.guestbook-actions :deep(.search-box) {
  min-width: 0;
  flex: 1;
}
.guestbook-clear {
  font-size: 0.8125rem;
}
.guestbook-end.guestbook-end--top {
  padding: 1rem 1rem 0;
}
.guestbook-clear,
.guestbook-more button {
  color: var(--accent-text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
}
.guestbook-more {
  padding: 0.5rem 1rem;
  text-align: center;
  color: var(--text-soft);
}
.guestbook-feedback {
  flex-shrink: 0;
  max-height: 40%;
  overflow: auto;
}
.guestbook-end {
  padding: 0.5rem 1rem 1rem;
  font-size: 0.75rem;
  text-align: center;
  color: var(--text-soft);
}
.guestbook-jump-pill {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  z-index: 5;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 44px;
  margin: 0;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-1);
  box-shadow: var(--shadow-card);
  color: var(--text-main);
  font-size: 0.75rem;
  white-space: nowrap;
}
button.guestbook-jump-pill {
  cursor: var(--interaction-cursor, pointer);
  &:hover {
    border-color: var(--border-hover);
  }
}
.guestbook-jump-pill__spin {
  animation: spin 1.2s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
.guestbook-scroll-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 6;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
}
@media (max-width: 1023px) {
  .guestbook-center {
    overflow: visible;
  }
}
@media (max-width: 640px) {
  .guestbook-page .main-content__header {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .guestbook-actions {
    width: 100%;
  }
}
</style>
