<!--
  @file moments.vue
  @description 朋友圈页面，展示动态流
  @author TixXin
  @since 2026-04-07
-->

<template>
  <div class="main-inner moments-page">
    <CommonCustomScrollbar class="moments-body" viewport-class="moments-viewport">
      <div class="moments-content">
        <div class="moments-header">
          <h2 class="moments-header__title">
            <Icon name="lucide:message-circle" size="20" class="moments-header__icon" />
            朋友圈
          </h2>
          <p class="moments-header__sub">记录生活点滴，分享日常碎片</p>
        </div>
        <MomentList :moments="moments" />
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarMomentAuthorCard :stats="authorStats" />
          <SidebarMomentCalendarCard :moment-dates="momentDates" />
          <SidebarMomentTopicCard :topics="momentTopics" />
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

// 作者名片数据
const authorStats: MomentAuthorStats = {
  totalMoments: mockMoments.length,
  totalLikes: mockMoments.reduce((sum, m) => sum + m.likes, 0),
  totalDays: 128,
  currentMood: '今天阳光正好，适合写代码 🌞',
}

// 日历数据 — 从动态列表提取日期
const momentDates = computed(() => mockMoments.map((m) => m.date.slice(0, 10)))

// 热门话题数据
const momentTopics: MomentTopic[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', count: 24, description: '记录每一天的小确幸' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', count: 18, description: '代码与灵感的碰撞' },
  { name: '读书笔记', icon: 'lucide:book-open', color: '#8b5cf6', count: 12, description: '阅读中的思考片段' },
  { name: '摄影记录', icon: 'lucide:camera', color: '#ec4899', count: 9, description: '用镜头捕捉瞬间' },
  { name: '美食探店', icon: 'lucide:utensils', color: '#ef4444', count: 7, description: '味蕾的冒险旅程' },
]
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

.moments-header {
  background: var(--surface-1);
  border-radius: $radius-lg;
  border: 1px solid var(--border-soft);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
  margin-bottom: 1.5rem;
}

.moments-header__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.moments-header__icon {
  color: var(--accent);
}

.moments-header__sub {
  font-size: 0.875rem;
  color: var(--text-soft);
  margin: 0.375rem 0 0 0;
}
</style>
