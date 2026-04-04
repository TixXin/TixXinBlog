<!--
  @file index.vue
  @description 博客首页，展示一言、博主自述、近期文章、关于博客与朋友圈动态
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner home-page">
    <CommonCustomScrollbar class="home-body" viewport-class="home-viewport">
      <div class="home-content">
        <!-- 顶部 Hero 区域：一言 + 博主自述 -->
        <BlogHeroSection />

        <!-- 近期文章 -->
        <BlogRecentPosts :posts="recentPosts" />

        <!-- 关于本站 -->
        <BlogAboutBlogCard />

        <!-- 朋友圈动态流 -->
        <div class="home-moments">
          <div class="home-moments__header">
            <h2 class="home-moments__title">
              <Icon name="lucide:message-circle" size="18" class="home-moments__icon" />
              朋友圈
            </h2>
          </div>
          <MomentList :moments="moments" />
        </div>
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarSiteStatsCard :stats="siteStats" />
          <SidebarHeatmapGrid />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockSiteStats } from '~/features/stats/mock'
import { mockPosts } from '~/features/post/mock'
import { mockMoments } from '~/features/moment/mock'

useSeoMeta({
  title: '首页',
  description: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
  ogTitle: '首页 - TixXin Blog',
  ogDescription: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
})

const siteStats = mockSiteStats
const recentPosts = computed(() => mockPosts.slice(0, 3))
const moments = computed(() => mockMoments)
</script>

<style lang="scss" scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.home-body {
  flex: 1;
  min-height: 0;
}

:deep(.home-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.home-content {
  max-width: 800px;
  margin: 0 auto;
}

.home-moments {
  background: var(--surface-1);
  border-radius: $radius-lg;
  border: 1px solid var(--border-soft);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
}

.home-moments__header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.home-moments__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.home-moments__icon {
  color: var(--accent);
}
</style>
