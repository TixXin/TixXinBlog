<!--
  @file index.vue
  @description 朋友圈列表页（原 moments.vue，为支持子路由 /moments/:id 迁移为目录式）
  @author TixXin
  @since 2026-04-07
-->

<template>
  <CommonPageFrame class="main-inner moments-page" header-key="feed">
    <template #header>
      <div class="main-content__header">
        <!-- 页签是视觉标题，读屏与大纲需要一个页面级 h1 -->
        <h1 class="sr-only">{{ $t('flash-moment.moments.title') }}</h1>
        <BlogPostTabs :tabs="tabs" model-value="moments" />
        <div class="page-actions">
          <BlogRssLink href="/moments.xml" :label="$t('article.rss.moments')" compact />
          <CommonSearchBox
            v-model="searchKeyword"
            :placeholder="$t('flash-moment.moments.searchPlaceholder')"
            class="moments-header__search"
          />
          <MomentInfoDrawer
            v-model:open="drawerOpen"
            :show-info="drawerInfo"
            :stats="authorStats"
            :profile="ownerCard"
            :dates="momentDates"
            :date-counts="momentDateCounts"
            :available="!!metadata"
            :selected-date="selectedDate"
            @select-date="onDateSelect"
          >
            <CommonRequestFeedback
              v-if="overviewError"
              compact
              :title="$t('flash-moment.moments.statsUnavailable')"
              :description="metadata ? $t('flash-moment.moments.statsStale') : undefined"
              :pending="overviewPending"
              @retry="refreshOverview()"
            />
            <SidebarMomentTopicCard :topics="momentTopics" :active-topic="selectedTopic" @select="onTopicSelect" />
            <button
              v-if="searchKeyword || selectedTopic || selectedDate"
              type="button"
              class="filter-clear"
              @click="clearFilters"
            >
              {{ $t('flash-moment.moments.clearFilters') }}
            </button>
            <SidebarMomentPhotoWallCard :images="photoWallImages" @select-moment="onPhotoSelect" />
            <SidebarMomentTimeCapsuleCard :moments="recollections" />
          </MomentInfoDrawer>
          <NuxtLink
            v-if="isOwner"
            to="/admin/moments/new"
            class="moments-header__publish"
            :aria-label="$t('flash-moment.moments.publishAria')"
          >
            <Icon name="lucide:plus" size="14" />
            <span>{{ $t('flash-moment.moments.publish') }}</span>
          </NuxtLink>
        </div>
      </div>
    </template>
    <template #default>
      <!-- 头部 Tab 栏 + 搜索筛选摘要 -->
      <MomentFilterSummary
        :visible="!!(searchKeyword || selectedTopic || selectedDate)"
        :filter-summary="filterSummary"
        @clear="clearFilters"
      />
      <CommonCustomScrollbar class="moments-body" viewport-class="moments-viewport" primary>
        <div class="moments-content">
          <MomentList
            :moments="moments"
            :owner-profile="ownerProfile"
            :states="interactions.states"
            :pending="feedPending"
            :error-message="feedError?.message"
            :has-more="hasMore"
            :filtered="!!(searchKeyword || selectedTopic || selectedDate)"
            :detail-query="filterQuery"
            @retry="retryFeed"
            @more="loadMore"
            @like="interactions.like"
            @draft="interactions.draft"
            @comment="interactions.submit"
            @comments="interactions.comments"
          />
        </div>
      </CommonCustomScrollbar>
    </template>
    <template #overlays>
      <MomentInteractionDialogs
        :visible="interactions.identityVisible.value"
        @confirm="interactions.confirmIdentity"
        @cancel="interactions.cancelIdentity"
        @login="interactions.switchToLogin"
      />
      <!-- 右栏内容交给能力位门控组件；资料归属仍由 momentInfoPlacement 派生的 rightInfo 决定 -->
      <CommonThemeSidebarPortal>
        <SidebarRightSidebar>
          <CommonRequestFeedback
            v-if="overviewError"
            class="card"
            compact
            :title="$t('flash-moment.moments.statsUnavailable')"
            :description="metadata ? $t('flash-moment.moments.statsStale') : undefined"
            :pending="overviewPending"
            @retry="refreshOverview()"
          />
          <SidebarMomentAuthorCard v-if="rightInfo" :stats="authorStats" :profile="ownerCard" />
          <SidebarMomentPhotoWallCard :images="photoWallImages" @select-moment="onPhotoSelect" />
          <SidebarMomentCalendarCard
            v-if="rightInfo"
            :moment-dates="momentDates"
            :date-counts="momentDateCounts"
            :available="!!metadata"
            :selected-date="selectedDate"
            @select-date="onDateSelect"
          />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="selectedTopic" @select="onTopicSelect" />
          <SidebarMomentTimeCapsuleCard :moments="recollections" />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { mockPostTabs } from '~/features/post/mock'

const pageScope = usePageRequestScope()
const { searchKeyword, selectedTopic, selectedDate, page, setPage, filterQuery, clearFilters } = useMomentFilters()
const interactions = useMomentInteractions()
const overviewRequest = useMomentOverview()
const feedRequest = useMomentFeed({ page, q: searchKeyword, topic: selectedTopic, date: selectedDate })
const [overview, feed] = await Promise.all([overviewRequest, feedRequest])
pageScope.assertActive()
const {
  metadata,
  authorStats,
  ownerCard,
  ownerProfile,
  momentTopics,
  momentDates,
  momentDateCounts,
  photoWallImages,
  moments: recollections,
  error: overviewError,
  pending: overviewPending,
  refresh: refreshOverview,
} = overview
const { moments, total, pending: feedPending, error: feedError, refresh: refreshFeed } = feed
const { rightInfo, drawerInfo, drawerOpen } = useMomentSidebarPlacement()
const { isLoggedIn: isOwner } = useCurrentUser()
const tabs = mockPostTabs
const { t } = useI18n()
const hasMore = computed(() => moments.value.length < total.value)
const advancing = ref(false)
watch(moments, interactions.seed, { immediate: true })
watch([total, feedPending, feedError], () => {
  if (!feedPending.value && !feedError.value && page.value > Math.max(1, Math.ceil(total.value / 15)))
    void setPage(Math.max(1, Math.ceil(total.value / 15)), true)
})
async function loadMore() {
  if (advancing.value || feedPending.value || feedError.value || !hasMore.value) return
  advancing.value = true
  try {
    await setPage(page.value + 1)
  } finally {
    advancing.value = false
  }
}
async function retryFeed() {
  await Promise.all([refreshFeed(), ...(overviewError.value ? [refreshOverview()] : [])])
}
// 筛选摘要：话题补 #、关键词加前缀，与闪念页的筛选条说法一致
const filterSummary = computed(() =>
  [
    searchKeyword.value ? t('flash-moment.moments.filterKeyword', { keyword: searchKeyword.value }) : '',
    selectedTopic.value ? '#' + selectedTopic.value : '',
    selectedDate.value,
  ]
    .filter(Boolean)
    .join(' · '),
)
function onTopicSelect(value: string | null) {
  selectedTopic.value = value
}
function onDateSelect(value: string | null) {
  selectedDate.value = value
}
function onPhotoSelect(id: string) {
  void navigateTo({ path: '/moments/' + encodeURIComponent(id), query: filterQuery.value })
}
usePageSeo({
  title: () => t('flash-moment.moments.seoTitle'),
  description: () => t('flash-moment.moments.seoDescription'),
  shareTitle: () => t('flash-moment.moments.shareTitle', { name: ownerCard.value.name }),
  type: 'website',
})
</script>

<style lang="scss" scoped>
.filter-clear {
  min-height: 44px;
  padding: 0.5rem;
  color: var(--accent-text);
}

.moments-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

// 仅博主可见的发布入口
.moments-header__publish {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: opacity 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.88;
  }
}

.moments-body {
  flex: 1;
  min-height: 0;
}

:deep(.moments-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moments-content {
  max-width: 800px;
  margin: 0 auto;
}
</style>
