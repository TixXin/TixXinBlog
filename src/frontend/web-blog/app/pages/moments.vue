<!--
  @file moments.vue
  @description 朋友圈页面，展示动态流
  @author TixXin
  @since 2026-04-07
-->

<template>
  <div class="main-inner moments-page">
    <CommonCustomScrollbar class="moments-body" viewport-class="moments-viewport" primary>
      <div class="moments-content">
        <MomentList :moments="moments" :selected-topic="selectedTopic" />
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarMomentAuthorCard :stats="authorStats" />
          <SidebarMomentCalendarCard :moment-dates="momentDates" />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="selectedTopic" @select="onTopicSelect" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockMoments } from '~/features/moment/mock'
import type { MomentAuthorStats } from '~/components/sidebar/MomentAuthorCard.vue'
import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'

useSeoMeta({
  title: '朋友圈',
  description: '记录生活点滴，分享日常碎片',
  ogTitle: '朋友圈 - TixXin Blog',
  ogDescription: '记录生活点滴，分享日常碎片',
})

const moments = computed(() => mockMoments)

// 话题筛选
const selectedTopic = ref<string | null>(null)

function onTopicSelect(topicName: string | null) {
  selectedTopic.value = topicName
}

// 作者名片数据
const authorStats: MomentAuthorStats = {
  totalMoments: mockMoments.length,
  totalLikes: mockMoments.reduce((sum, m) => sum + m.likes, 0),
  totalDays: 128,
  currentMood: '今天阳光正好，适合写代码 🌞',
}

// 日历数据 — 从动态列表提取日期
const momentDates = computed(() => mockMoments.map((m) => m.date.slice(0, 10)))

// 热门话题 — 话题定义与动态计数
const TOPIC_DEFINITIONS: Omit<MomentTopic, 'count'>[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', description: '记录每一天的小确幸' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', description: '代码与灵感的碰撞' },
  { name: '读书笔记', icon: 'lucide:book-open', color: '#8b5cf6', description: '阅读中的思考片段' },
  { name: '摄影记录', icon: 'lucide:camera', color: '#ec4899', description: '用镜头捕捉瞬间' },
  { name: '美食探店', icon: 'lucide:utensils', color: '#ef4444', description: '味蕾的冒险旅程' },
]

const momentTopics = computed<MomentTopic[]>(() =>
  TOPIC_DEFINITIONS.map((t) => ({
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
