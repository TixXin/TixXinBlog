<!--
  @file [name].vue
  @description 朋友圈话题聚合页：单一话题下的全部动态时间线
  @author TixXin
  @since 2026-04-17
-->

<template>
  <CommonPageFrame class="main-inner moment-topic-page" header-key="moment-return">
    <template #header>
      <div class="main-content__header moment-topic-header">
        <NuxtLink to="/moments" class="back-btn" aria-label="返回朋友圈">
          <Icon name="lucide:arrow-left" size="16" />
          <span>返回朋友圈</span>
        </NuxtLink>
        <MomentInfoDrawer
          v-model:open="drawerOpen"
          label="动态信息"
          :show-info="drawerInfo"
          :stats="authorStats"
          :profile="ownerCard"
          :dates="momentDates"
          :date-counts="momentDateCounts"
          :available="!!metadata"
          :selected-date="selectedDate"
          @select-date="selectedDate = $event"
        >
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="topicName" @select="onTopicSelect" />
        </MomentInfoDrawer>
      </div>
    </template>
    <template #default>
      <!-- 顶部返回栏 -->
      <CommonCustomScrollbar class="moment-topic-body" viewport-class="moment-topic-viewport" primary>
        <div class="moment-topic-content">
          <!-- 话题 Hero -->
          <header v-if="topicMeta" class="moment-topic-hero" :style="heroStyle">
            <div class="moment-topic-hero__icon">
              <Icon :name="topicMeta.icon" size="24" />
            </div>
            <div class="moment-topic-hero__text">
              <h1 class="moment-topic-hero__name">#{{ topicMeta.name }}</h1>
              <p v-if="topicMeta.description" class="moment-topic-hero__desc">{{ topicMeta.description }}</p>
              <p class="moment-topic-hero__count">共 {{ feedError && !moments.length ? '—' : total }} 条动态</p>
            </div>
          </header>

          <!-- 未知话题降级 -->
          <header v-else class="moment-topic-hero moment-topic-hero--unknown">
            <div class="moment-topic-hero__icon">
              <Icon name="lucide:hash" size="24" />
            </div>
            <div class="moment-topic-hero__text">
              <h1 class="moment-topic-hero__name">#{{ topicName }}</h1>
              <p class="moment-topic-hero__count">共 {{ feedError && !moments.length ? '—' : total }} 条动态</p>
            </div>
          </header>

          <MomentList
            :moments="moments"
            :owner-profile="ownerProfile"
            :states="interactions.states"
            :pending="feedPending"
            :error-message="feedError?.message"
            :has-more="hasMore"
            filtered
            :detail-query="filterQuery"
            @retry="refreshFeed()"
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
            <SidebarMomentCalendarCard
              v-if="rightInfo"
              :moment-dates="momentDates"
              :date-counts="momentDateCounts"
              :available="!!metadata"
              :selected-date="selectedDate"
              @select-date="selectedDate = $event"
            />
            <SidebarMomentTopicCard :topics="momentTopics" :active-topic="topicName" @select="onTopicSelect" />
          </SidebarRightSidebar>
        </Teleport>
      </ClientOnly>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { findMomentTopic } from '~/features/moment/topics'
const pageScope = usePageRequestScope()
const route = useRoute()
const { selectedDate, selectedTopic, searchKeyword, page, setPage, filterQuery } = useMomentFilters()
const interactions = useMomentInteractions()
const [overview, feed] = await Promise.all([
  useMomentOverview(),
  useMomentFeed({ page, q: searchKeyword, topic: selectedTopic, date: selectedDate }),
])
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
const { moments, total, pending: feedPending, error: feedError, refresh: refreshFeed } = feed
const { rightInfo, drawerInfo, drawerOpen } = useMomentSidebarPlacement()
const topicName = computed(() => String(route.params.name ?? ''))
const topicMeta = computed(() => findMomentTopic(topicName.value))
const heroStyle = computed(() => ({ '--topic-color': topicMeta.value?.color ?? 'var(--accent)' }))
const hasMore = computed(() => moments.value.length < total.value)
const advancing = ref(false)
watch(moments, interactions.seed, { immediate: true })
async function loadMore() {
  if (advancing.value || feedPending.value || feedError.value || !hasMore.value) return
  advancing.value = true
  try {
    await setPage(page.value + 1)
  } finally {
    advancing.value = false
  }
}
function onTopicSelect(value: string | null) {
  selectedTopic.value = value
}
useSeoMeta({
  title: () => '#' + topicName.value,
  description: () => '朋友圈中关于 ' + topicName.value + ' 的公开动态',
  ogTitle: () => '#' + topicName.value + ' - ' + ownerCard.value.name + ' 朋友圈',
})
</script>

<style lang="scss" scoped>
.moment-topic-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.moment-topic-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.moment-topic-body {
  flex: 1;
  min-height: 0;
}

:deep(.moment-topic-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moment-topic-content {
  max-width: 800px;
  margin: 0 auto;
}

.moment-topic-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--topic-color) 12%, transparent), var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--topic-color) 25%, var(--border-soft));
  border-radius: $radius-md;

  &--unknown {
    background: var(--surface-2);
    border-color: var(--border-soft);
  }
}

.moment-topic-hero__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--topic-color) 20%, transparent);
  color: var(--topic-color);
  border-radius: $radius-md;
}

.moment-topic-hero__text {
  flex: 1;
  min-width: 0;
}

.moment-topic-hero__name {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}

.moment-topic-hero__desc {
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
  color: var(--text-soft);
}

.moment-topic-hero__count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-faint);
}
</style>
