<!--
  @file index.vue
  @description 朋友圈列表页（原 moments.vue，为支持子路由 /moments/:id 迁移为目录式）
  @author TixXin
  @since 2026-04-07
-->

<template>
  <div class="main-inner moments-page">
    <!-- 头部 Tab 栏 + 搜索 -->
    <div class="main-content__header moments-header">
      <div class="articles-tabs no-scrollbar" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          role="tab"
          :aria-selected="tab.value === 'moments'"
          class="tab-btn"
          :class="{ 'tab-active': tab.value === 'moments' }"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
      <CommonSearchBox
        v-model="searchKeyword"
        placeholder="搜索动态内容 / 话题 / 地点..."
        class="moments-header__search"
      />
    </div>

    <CommonCustomScrollbar class="moments-body" viewport-class="moments-viewport" primary>
      <div class="moments-content">
        <MomentList
          :moments="moments"
          :selected-topic="selectedTopic"
          :selected-date="selectedDate"
          :keyword="searchKeyword"
        />
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarMomentAuthorCard :stats="authorStats" />
          <SidebarMomentPhotoWallCard :images="photoWallImages" @select-moment="onPhotoSelect" />
          <SidebarMomentCalendarCard
            :moment-dates="momentDates"
            :selected-date="selectedDate"
            @select-date="onDateSelect"
          />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="selectedTopic" @select="onTopicSelect" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockMoments, mockMomentAuthorStats } from '~/features/moment/mock'
import { MOMENT_TOPIC_DEFINITIONS } from '~/features/moment/topics'
import { mockPostTabs } from '~/features/post/mock'
import type { MomentItem } from '~/features/moment/types'
import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'
import type { MomentPhotoItem } from '~/components/sidebar/MomentPhotoWallCard.vue'

const tabs = mockPostTabs

function switchTab(value: string) {
  if (value !== 'moments') {
    navigateTo('/')
  }
}

useSeoMeta({
  title: '朋友圈',
  description: '记录生活点滴，分享日常碎片',
  ogTitle: '朋友圈 - TixXin Blog',
  ogDescription: '记录生活点滴，分享日常碎片',
})

const moments = computed(() => mockMoments)

// 搜索关键词（fuse.js 模糊匹配 content/topics/location）
const searchKeyword = ref('')

// 话题筛选
const selectedTopic = ref<string | null>(null)

function onTopicSelect(topicName: string | null) {
  selectedTopic.value = topicName
}

// 日期筛选
const selectedDate = ref<string | null>(null)

function onDateSelect(date: string | null) {
  selectedDate.value = date
}

// 照片点击 — 滚动到对应动态
function onPhotoSelect(momentId: string) {
  const el = document.getElementById(`moment-${momentId}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// 作者名片数据
const authorStats = mockMomentAuthorStats

// 日历数据 — 从动态列表提取日期
const momentDates = computed(() => mockMoments.map((m) => m.date.slice(0, 10)))

// 精选照片墙 — 按获赞数排序，取带图片的动态的首张图
const photoWallImages = computed<MomentPhotoItem[]>(() => {
  return mockMoments
    .filter((m): m is MomentItem & { images: [string, ...string[]] } => !!m.images && m.images.length > 0)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 9)
    .map((m) => ({
      src: m.images[0],
      momentId: m.id,
    }))
})

// 热门话题 — 复用共享话题定义，动态计数
const momentTopics = computed<MomentTopic[]>(() =>
  MOMENT_TOPIC_DEFINITIONS.map((t) => ({
    ...t,
    count: mockMoments.filter((m) => m.topics?.includes(t.name)).length,
  })),
)
</script>

<style lang="scss" scoped>
.moments-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

// 顶部 Tab + 搜索：大屏同一行，窄屏降级为多行
.moments-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.moments-header__search {
  margin-left: auto;
  max-width: 16rem;

  @media (max-width: #{$breakpoint-sm - 1px}) {
    width: 100%;
    max-width: none;
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
