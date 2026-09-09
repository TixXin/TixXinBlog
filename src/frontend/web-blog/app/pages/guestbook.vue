<!-- @file guestbook.vue @description 真实留言页面，聊天/论坛共用游标流、输入状态和侧栏聚合 -->
<template>
  <CommonPageFrame class="main-inner guestbook-page" header-key="guestbook">
    <template #header>
      <div class="main-content__header">
        <div class="page-title">
          <div class="page-title__icon-wrap" aria-hidden="true"><Icon name="lucide:message-circle" size="18" /></div>
          <div class="page-title__text">
            <h2 class="page-title__heading">留言板</h2>
            <p class="page-title__sub">{{ metadata?.stats.messages.toLocaleString('zh-CN') ?? '—' }} 条公开留言</p>
          </div>
        </div>
        <div class="page-actions guestbook-actions">
          <CommonSearchBox v-model="search" label="搜索留言" placeholder="搜索留言或作者…" />
          <button v-if="search || selectedDate" type="button" class="guestbook-clear" @click="clearFilters">
            清除筛选
          </button>
          <CommonContextDrawer v-if="!rightVisible" v-model:open="infoOpen" label="留言信息" icon="lucide:info"
            ><GuestbookOverview
              :data="metadata"
              :pending="metadataPending"
              :error="metadataError?.message"
              @retry="refreshMetadata()"
          /></CommonContextDrawer>
          <NuxtLink v-if="isLoggedIn" to="/admin/guestbook" class="guestbook-clear">管理</NuxtLink>
        </div>
      </div>
    </template>
    <template #default>
      <div class="guestbook-center" :data-display-mode="isChatMode ? 'chat' : 'forum'">
        <GuestbookPinnedMessage v-if="pinned" :key="pinned.id" :message="pinned" />
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
        <div ref="messagesWrap" class="guestbook-center__messages-wrap">
          <div v-if="pending || feedError" class="guestbook-feedback">
            <CommonRequestFeedback
              :compact="items.length > 0"
              :pending="pending"
              :title="feedError?.message || '正在加载留言'"
              :description="items.length ? '仍显示上次成功读取的内容。' : undefined"
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
            <div v-if="isChatMode && hasMore" ref="topSentinel" class="guestbook-more">
              <button
                type="button"
                :disabled="pending || morePending || !personalized"
                @click="moreError ? retryMore() : loadMore()"
              >
                {{ morePending ? '正在加载历史…' : moreError ? '重试加载历史' : '加载历史留言' }}
              </button>
              <p v-if="moreError" role="alert">{{ moreError }}</p>
            </div>
            <GuestbookMessageSkeleton v-if="pending && !items.length" />
            <GuestbookEmptyState v-else-if="!pending && !feedError && !items.length" @compose="focusInput" />
            <GuestbookMessageList
              :groups="groups"
              :interactive="personalized && !pending"
              :reacting="interactions.reacting.value"
              :reaction-errors="interactions.reactionErrors.value"
              @reply="reply"
              @react="interactions.react"
            />
            <div v-if="!isChatMode && hasMore" ref="bottomSentinel" class="guestbook-more">
              <button
                type="button"
                :disabled="pending || morePending || !personalized"
                @click="moreError ? retryMore() : loadMore()"
              >
                {{ morePending ? '正在加载…' : moreError ? '重试加载更多' : '加载更多留言' }}
              </button>
              <p v-if="moreError" role="alert">{{ moreError }}</p>
            </div>
            <p v-if="!hasMore && items.length && !pending && !feedError" class="guestbook-end">
              已显示当前范围的全部留言
            </p>
          </CommonCustomScrollbar>
          <button
            v-if="isChatMode && !atBottom"
            type="button"
            class="guestbook-scroll-bottom"
            aria-label="回到最新留言"
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
  atBottom = ref(true)
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
const { data: metadata, pending: metadataPending, error: metadataError, refresh: refreshMetadata } = overview
const groups = computed(() => guestbookGroups(items.value, isChatMode.value))
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
  observer?.disconnect()
  bottomResize?.disconnect()
  boundScroll?.removeEventListener('scroll', checkBottom)
})
useSeoMeta({ title: '留言板', description: '留下你的足迹，交流技术与生活。', ogTitle: '留言板', ogType: 'website' })
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
.guestbook-center__messages {
  flex: 1;
  min-height: 0;
}
.guestbook-center :deep(.guestbook-viewport) {
  overflow-anchor: none;
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
.guestbook-scroll-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
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
