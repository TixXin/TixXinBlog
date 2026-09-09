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
        <BlogPostTabs :tabs="tabs" model-value="moments" />
        <div class="page-actions">
          <CommonSearchBox
            v-model="searchKeyword"
            placeholder="搜索动态内容 / 话题 / 地点..."
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
              title="动态统计暂时不可用"
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
              清除动态筛选
            </button>
            <SidebarMomentPhotoWallCard :images="photoWallImages" @select-moment="onPhotoSelect" />
            <SidebarMomentTimeCapsuleCard :moments="recollections" />
          </MomentInfoDrawer>
          <NuxtLink v-if="isOwner" to="/admin/moments/new" class="moments-header__publish" aria-label="发布新动态">
            <Icon name="lucide:plus" size="14" />
            <span>发布</span>
          </NuxtLink>
        </div>
      </div>
    </template>
    <template #default>
      <!-- 头部 Tab 栏 + 搜索 -->
      <div v-if="searchKeyword || selectedTopic || selectedDate" class="moments-filter-summary">
        <span role="status"
          >当前筛选：{{ [searchKeyword, selectedTopic, selectedDate].filter(Boolean).join(' · ') }}</span
        >
        <button type="button" class="filter-clear" @click="clearFilters">清除动态筛选</button>
      </div>
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
      <ClientOnly>
        <Teleport to="#right-sidebar-target">
          <SidebarRightSidebar>
            <CommonRequestFeedback
              v-if="overviewError"
              class="card"
              compact
              title="动态统计暂时不可用"
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
        </Teleport>
      </ClientOnly>
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
function onTopicSelect(value: string | null) {
  selectedTopic.value = value
}
function onDateSelect(value: string | null) {
  selectedDate.value = value
}
function onPhotoSelect(id: string) {
  void navigateTo({ path: '/moments/' + encodeURIComponent(id), query: filterQuery.value })
}
useSeoMeta({
  title: '朋友圈',
  description: '记录生活点滴，分享日常碎片',
  ogTitle: () => ownerCard.value.name + ' 的朋友圈',
})
</script>

<style lang="scss" scoped>
.moments-filter-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  color: var(--text-soft);
}
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
