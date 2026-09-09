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
        <NuxtLink :to="{ path: '/moments', query: filterQuery }" class="back-btn" aria-label="返回朋友圈">
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
            title="动态不存在"
            description="这条动态可能已被删除或链接有误"
          >
            <NuxtLink to="/moments" class="back-link">
              <Icon name="lucide:arrow-left" size="14" />
              返回朋友圈
            </NuxtLink>
          </CommonStateBlock>

          <!-- 动态卡片 + 上下条导航 -->
          <template v-else>
            <article class="moment-detail-card">
              <CommonRequestFeedback
                v-if="detailError"
                compact
                title="动态更新失败，仍显示已加载的内容"
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
              title="动态导航暂时不可用"
              @retry="refreshNavigation()"
            />
            <nav class="moment-detail-nav" aria-label="动态导航">
              <NuxtLink
                v-if="prevMoment"
                :to="{ path: `/moments/${prevMoment.id}`, query: filterQuery }"
                class="moment-detail-nav__item moment-detail-nav__item--prev"
              >
                <Icon name="lucide:chevron-left" size="18" class="moment-detail-nav__arrow" />
                <div class="moment-detail-nav__text">
                  <span class="moment-detail-nav__label">上一条</span>
                  <span class="moment-detail-nav__title">{{ truncate(prevMoment.content, 40) }}</span>
                </div>
              </NuxtLink>
              <span v-else class="moment-detail-nav__placeholder" />

              <NuxtLink
                v-if="nextMoment"
                :to="{ path: `/moments/${nextMoment.id}`, query: filterQuery }"
                class="moment-detail-nav__item moment-detail-nav__item--next"
              >
                <div class="moment-detail-nav__text">
                  <span class="moment-detail-nav__label">下一条</span>
                  <span class="moment-detail-nav__title">{{ truncate(nextMoment.content, 40) }}</span>
                </div>
                <Icon name="lucide:chevron-right" size="18" class="moment-detail-nav__arrow" />
              </NuxtLink>
              <span v-else class="moment-detail-nav__placeholder" />
            </nav>
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
            <SidebarMomentTopicCard :topics="momentTopics" :active-topic="null" @select="onTopicSelect" />
          </SidebarRightSidebar>
        </Teleport>
      </ClientOnly>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
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
function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) + '…' : value
}
function onTopicSelect(value: string | null) {
  selectedTopic.value = value
}
const excerpt = computed(() => moment.value?.content.replace(/\s+/g, ' ').slice(0, 120) ?? '动态不存在')
const pageTitle = computed(() => truncate(excerpt.value, 36))
useSeoMeta({
  title: () => pageTitle.value,
  description: () => excerpt.value,
  ogTitle: () => pageTitle.value + ' - ' + ownerCard.value.name + ' 朋友圈',
  ogDescription: () => excerpt.value,
  ogType: 'article',
  ogImage: () => moment.value?.images?.[0] ?? ownerCard.value.avatar,
  twitterCard: 'summary_large_image',
})
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        moment.value
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              headline: pageTitle.value,
              articleBody: moment.value.content,
              datePublished: moment.value.date,
              image: moment.value.images ?? [],
              author: { '@type': 'Person', name: ownerCard.value.name },
            }).replace(/</g, String.fromCharCode(92) + 'u003c')
          : '',
      ),
    },
  ],
})
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
  cursor: pointer;
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

// 上一条 / 下一条导航
.moment-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.moment-detail-nav__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  color: inherit;
  text-decoration: none;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  min-width: 0;

  &:hover {
    background: var(--surface-3);
    border-color: var(--border);
    transform: translateY(-1px);
  }

  &--next {
    justify-content: flex-end;
    text-align: right;
  }
}

.moment-detail-nav__placeholder {
  visibility: hidden;
}

.moment-detail-nav__arrow {
  flex-shrink: 0;
  color: var(--text-soft);
}

.moment-detail-nav__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.moment-detail-nav__label {
  font-size: 0.75rem;
  color: var(--text-faint);
}

.moment-detail-nav__title {
  font-size: 0.875rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
