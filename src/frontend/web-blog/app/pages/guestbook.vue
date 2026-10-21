<!-- @file guestbook.vue @description 真实留言页面，聊天/论坛共用游标流、输入状态和侧栏聚合 -->
<template>
  <CommonPageFrame class="main-inner guestbook-page" header-key="guestbook">
    <template #header>
      <GuestbookHeader
        v-model:search="search"
        v-model:info-open="infoOpen"
        :selected-date="selectedDate"
        :message-count-text="messageCountText"
        :metadata="overview.data.value"
        :metadata-pending="overview.pending.value"
        :metadata-error="overview.error.value"
        :right-visible="rightVisible"
        @clear-filters="clearFilters"
        @retry-metadata="overview.refresh()"
      />
    </template>
    <template #default>
      <div class="guestbook-center" :data-display-mode="isChatMode ? 'chat' : 'forum'">
        <GuestbookComposer v-if="!isChatMode" :composer-props="composerProps" :interactions="interactions" />
        <div
          ref="messagesWrap"
          class="guestbook-center__messages-wrap"
          :class="{ 'guestbook-center__messages-wrap--reply-pad': !isChatMode && interactions.state.reply }"
          tabindex="-1"
        >
          <GuestbookFeedFeedback
            :pending="feed.pending.value"
            :error="feed.error.value?.message"
            :has-items="feed.items.value.length > 0"
            @retry="feed.refresh()"
          />
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
            <div v-if="isChatMode && (feed.hasMore.value || retryingMore)" ref="topSentinel" class="guestbook-more">
              <GuestbookHistoryLoader
                :is-chat-mode="true"
                :error="feed.moreError.value"
                :retrying="retryingMore"
                :pending="feed.pending.value"
                :more-pending="feed.morePending.value"
                :personalized="feed.personalized.value"
                @retry="retryHistory()"
                @load-more="feed.loadMore()"
              />
            </div>
            <GuestbookMessageSkeleton v-if="feed.pending.value && !feed.items.value.length" />
            <GuestbookEmptyState
              v-else-if="!feed.pending.value && !feed.error.value && !feed.items.value.length"
              :filter="filterLabel"
              @compose="focusInput"
              @clear="clearFilters"
            />
            <GuestbookMessageList
              :groups="groups"
              :interactive="feed.personalized.value && !feed.pending.value"
              :reacting="interactions.reacting.value"
              :reaction-errors="interactions.reactionErrors.value"
              :highlight="search"
              @reply="reply"
              @react="interactions.react"
              @jump="jumpToMessage"
            />
            <div v-if="!isChatMode && (feed.hasMore.value || retryingMore)" ref="bottomSentinel" class="guestbook-more">
              <GuestbookHistoryLoader
                :is-chat-mode="false"
                :error="feed.moreError.value"
                :retrying="retryingMore"
                :pending="feed.pending.value"
                :more-pending="feed.morePending.value"
                :personalized="feed.personalized.value"
                @retry="retryHistory()"
                @load-more="feed.loadMore()"
              />
            </div>
            <p v-if="!isChatMode && historyComplete" class="guestbook-end">
              {{ t('interaction.guestbook.endAll') }}
            </p>
          </CommonCustomScrollbar>

          <GuestbookNavPills
            :locating="locating"
            :jump-origin="jumpOrigin"
            :is-chat-mode="isChatMode"
            :at-bottom="atBottom"
            @back-to-origin="backToOrigin"
            @scroll-latest="scrollLatest(true)"
          />
        </div>
        <GuestbookComposer v-if="isChatMode" :composer-props="composerProps" :interactions="interactions" />
      </div>
    </template>
    <template #overlays>
      <GuestbookOverlays
        :identity-visible="interactions.identityVisible.value"
        :metadata="overview.data.value"
        :metadata-pending="overview.pending.value"
        :metadata-error="overview.error.value?.message"
        @confirm-identity="interactions.confirmIdentity"
        @cancel-identity="interactions.identityVisible.value = false"
        @login="interactions.openLogin"
        @retry-metadata="overview.refresh()"
      />
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { guestbookGroups, guestbookComposerProps, useGuestbookStats } from '~/features/guestbook/display'
import { useGuestbookScroll } from '~/features/guestbook/useGuestbookScroll'
import { useGuestbookJump } from '~/features/guestbook/useGuestbookJump'
import { useGuestbookRouteFilters } from '~/features/guestbook/useGuestbookRouteFilters'
import { useGuestbookResponsive } from '~/features/guestbook/useGuestbookResponsive'
import type { GuestMessage, GuestbookRecord } from '~/features/guestbook/types'

const pageScope = usePageRequestScope()
const { t } = useI18n()
const { currentThemeId, mounted, infoOpen, isChatMode, rightVisible } = useGuestbookResponsive()
const { search, selectedDate, clearFilters, filterLabel } = useGuestbookRouteFilters()

let onSent: (record: GuestbookRecord) => Promise<void> = async () => {}
const interactions = useGuestbookInteractions((record) => onSent(record))

const scrollHelper = useGuestbookScroll({ isChatMode, mounted, pageScope })
const {
  scrollbar,
  messagesWrap,
  topSentinel,
  bottomSentinel,
  atBottom,
  retryingMore,
  scrollLatest,
  retryHistory,
  initialize,
  setupObserver,
  attachFeed,
} = scrollHelper

const [feed, overview] = await Promise.all([
  useGuestbookFeed({
    q: search,
    date: selectedDate,
    beforeChange: () => scrollHelper.captureAnchor(),
    afterChange: () => scrollHelper.restoreAnchor(),
  }),
  useGuestbookMetadata(),
])
pageScope.assertActive()
attachFeed(feed)

const { jumpOrigin, locating, jumpToMessage, backToOrigin } = useGuestbookJump({
  messagesWrap,
  feed,
  search,
  selectedDate,
  pageScope,
  onReveal: scrollHelper.resetFollowingLatest,
})

const focusInput = () => nextTick(() => document.querySelector<HTMLTextAreaElement>('.message-input__editor')?.focus())
const reply = (message: GuestMessage) => {
  interactions.setReply(message)
  focusInput()
}

const { settings: siteSettings } = useSiteSettings()
const groups = computed(() => guestbookGroups(feed.items.value, isChatMode.value, siteSettings.value.avatar))
const { messageCountText, historyComplete, pinned } = useGuestbookStats(
  overview.data,
  feed.hasMore,
  computed(() => feed.items.value.length),
  feed.pending,
  feed.error,
)

const composerProps = guestbookComposerProps(interactions, isChatMode)

onSent = async (record) => {
  await Promise.all([feed.settled(), overview.refresh()])
  await nextTick()
  if (pageScope.signal.aborted) return
  if (feed.items.value.some((item) => item.id === record.id)) {
    if (isChatMode.value) scrollLatest()
    else
      messagesWrap.value
        ?.querySelector<HTMLElement>(`[data-guestbook-id="${record.id}"]`)
        ?.scrollIntoView({ block: 'nearest' })
  }
}

watch([isChatMode, currentThemeId, rightVisible], async () => {
  scrollHelper.captureAnchor()
  infoOpen.value = false
  await nextTick()
  scrollHelper.restoreAnchor()
})

watch([() => feed.items.value.length, feed.hasMore, feed.personalized], async () => {
  await nextTick()
  initialize()
  setupObserver()
})

onMounted(async () => {
  mounted.value = true
  await nextTick()
  initialize()
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

  &--reply-pad {
    padding-top: 2.5rem;
  }
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

  &:empty {
    display: none;
  }

  &--sticky {
    position: sticky;
    top: 0;
    z-index: 4;
    padding-bottom: 0.75rem;
    margin-bottom: -0.75rem;
    background: linear-gradient(to bottom, var(--surface-1) calc(100% - 0.75rem), transparent);
  }
}

.guestbook-end {
  padding: 0.5rem 1rem 1rem;
  font-size: 0.75rem;
  text-align: center;
  color: var(--text-soft);

  &--top {
    padding: 1rem 1rem 0;
  }
}

@media (max-width: 1023px) {
  .guestbook-center {
    overflow: visible;
  }
}
</style>
