<!--
  @file archive.vue
  @description 文章归档独立页面，按年份时间线展示全部文章并提供分类分布统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="main-inner archive-page">
    <!-- 头部区域 -->
    <div class="main-content__header">
      <div class="page-title">
        <div class="page-title__icon-wrap" aria-hidden="true">
          <Icon name="lucide:archive" size="18" />
        </div>
        <div class="page-title__text">
          <h2 class="page-title__heading">文章归档</h2>
          <p class="page-title__sub">共 {{ totalCount }} 篇文章，持续记录中...</p>
        </div>
      </div>

      <!-- 右侧操作区：仅搜索框 -->
      <div class="page-actions">
        <CommonSearchBox placeholder="搜索文章标题、内容..." readonly @click="openSearch" />
      </div>
    </div>

    <!-- 主内容：归档时间线 -->
    <CommonCustomScrollbar
      class="archive-body"
      viewport-class="archive-viewport"
      :show-back-to-top="false"
      primary
    >
      <ArticleArchiveTimeline :years="archiveYears" />
    </CommonCustomScrollbar>

    <!-- 右侧栏：归档统计 + 分类分布 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <ArticleArchiveStats :stats="archiveStats" :distribution="categoryDistribution" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockArchiveStats, mockArchiveYears, mockCategoryDistribution } from '~/features/article/mock'

const archiveYears = mockArchiveYears
const archiveStats = mockArchiveStats
const categoryDistribution = mockCategoryDistribution

// 累加各年文章数，避免依赖 mockPosts，保持数据源一致
const totalCount = computed(() => archiveYears.reduce((sum, year) => sum + year.count, 0))

useSeoMeta({
  title: '归档',
  description: '按时间线回顾全部文章，浏览历年技术沉淀与生活随笔',
  ogTitle: '归档 - TixXin Blog',
  ogDescription: '按时间线回顾全部文章，浏览历年技术沉淀与生活随笔',
})

const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}
</script>

<style lang="scss" scoped>
/* 归档时间线滚动区 */
.archive-body {
  flex: 1;
  padding: 0;
}

:deep(.archive-viewport) {
  padding: 1.5rem 2rem 2rem;
}
</style>
