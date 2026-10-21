<!--
  @file [id].vue
  @description 朋友圈单条动态详情页：独立 URL、OG 卡、上一条/下一条导航
  @author TixXin
  @since 2026-04-17
-->

<template>
  <CommonPageFrame class="main-inner moment-detail-page" header-key="moment-return">
    <template #header>
      <div class="main-content__header moment-detail-header">
        <h1 class="sr-only">{{ pageTitle }}</h1>
        <NuxtLink
          :to="{ path: '/moments', query: filterQuery }"
          class="back-btn"
          :aria-label="$t('flash-moment.momentDetail.back')"
        >
          <Icon name="lucide:arrow-left" size="16" />
          <span>{{ $t('flash-moment.momentDetail.back') }}</span>
        </NuxtLink>
        <MomentInfoDrawer
          v-model:open="drawerOpen"
          :label="$t('flash-moment.momentDetail.infoLabel')"
          :show-info="drawerInfo"
          :stats="authorStats"
          :profile="ownerCard"
          :dates="momentDates"
          :date-counts="momentDateCounts"
          :available="!!metadata"
          :selected-date="selectedDate"
          @select-date="selectedDate = $event"
        >
          <CommonRequestFeedback
            v-if="overviewError"
            compact
            :title="$t('flash-moment.moments.statsUnavailable')"
            :description="metadata ? $t('flash-moment.moments.statsStale') : undefined"
            :pending="overviewPending"
            @retry="refreshOverview()"
          />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="null" @select="onTopicSelect" />
        </MomentInfoDrawer>
      </div>
    </template>
    <template #default>
      <!-- 顶部返回栏 -->
      <CommonCustomScrollbar class="moment-detail-body" viewport-class="moment-detail-viewport" primary>
        <div class="moment-detail-content">
          <!-- 动态不存在 -->
          <CommonStateBlock
            v-if="!moment"
            icon="lucide:search-x"
            :title="$t('flash-moment.momentDetail.notFound')"
            :description="$t('flash-moment.momentDetail.notFoundDesc')"
          >
            <NuxtLink to="/moments" class="back-link">
              <Icon name="lucide:arrow-left" size="14" />
              {{ $t('flash-moment.momentDetail.back') }}
            </NuxtLink>
          </CommonStateBlock>

          <!-- 动态卡片 + 上下条导航 -->
          <template v-else>
            <article class="moment-detail-card">
              <CommonRequestFeedback
                v-if="detailError"
                compact
                :pending="detailPending"
                :title="$t('flash-moment.momentDetail.refreshFailed')"
                @retry="refreshDetail()"
              />
              <MomentCard
                :moment="moment"
                :owner-profile="ownerProfile"
                :state="interactions.states[moment.id]"
                :syncing="detailPending"
                :detail-query="filterQuery"
                @like="interactions.like"
                @draft="interactions.draft"
                @comment="interactions.submit"
                @comments="interactions.comments"
              />
            </article>

            <CommonRequestFeedback
              v-if="navigationError"
              compact
              :pending="navigationPending"
              :title="$t('flash-moment.momentDetail.navUnavailable')"
              @retry="refreshNavigation()"
            />
            <MomentDetailNav :prev-moment="prevMoment" :next-moment="nextMoment" :filter-query="filterQuery" />
          </template>
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
          <SidebarMomentCalendarCard
            v-if="rightInfo"
            :moment-dates="momentDates"
            :date-counts="momentDateCounts"
            :available="!!metadata"
            :selected-date="selectedDate"
            @select-date="selectedDate = $event"
          />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="null" @select="onTopicSelect" />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { useMomentDetailSeo } from '~/features/moment/useMomentDetailSeo'

const pageScope = usePageRequestScope()
const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const { selectedDate, selectedTopic, filterQuery } = useMomentFilters()
const interactions = useMomentInteractions()
const [overview, detail] = await Promise.all([useMomentOverview(), useMomentDetail(id)])
pageScope.assertActive()
const {
  metadata,
  authorStats,
  ownerCard,
  ownerProfile,
  momentTopics,
  momentDates,
  momentDateCounts,
  error: overviewError,
  pending: overviewPending,
  refresh: refreshOverview,
} = overview
const {
  moment,
  pending: detailPending,
  error: detailError,
  refresh: refreshDetail,
  navigation,
  navigationPending,
  navigationError,
  refreshNavigation,
} = detail
const { rightInfo, drawerInfo, drawerOpen } = useMomentSidebarPlacement()
watch(
  moment,
  (value) => {
    if (value) interactions.seed([value])
  },
  { immediate: true },
)
const prevMoment = computed(() => navigation.value?.prev ?? null)
const nextMoment = computed(() => navigation.value?.next ?? null)
function onTopicSelect(value: string | null) {
  selectedTopic.value = value
}

const ownerName = computed(() => ownerCard.value.name)
const { pageTitle } = useMomentDetailSeo({ id, moment, ownerName })
</script>

<style lang="scss" scoped>
.moment-detail-notice {
  color: var(--text-soft);
  font-size: 0.8125rem;
  padding: 0.75rem 0;
}
.moment-detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.moment-detail-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.moment-detail-body {
  flex: 1;
  min-height: 0;
}

:deep(.moment-detail-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moment-detail-content {
  max-width: 800px;
  margin: 0 auto;
}

.moment-detail-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  padding: 0.5rem 1.25rem;
  margin-bottom: 1.5rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 1rem;
  color: var(--accent-text);
  text-decoration: none;
  font-size: 0.875rem;

  &:hover {
    text-decoration: underline;
  }
}
</style>
