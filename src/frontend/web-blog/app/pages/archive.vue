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
      <div class="archive-title">
        <h2 class="archive-title__heading">
          <Icon name="lucide:archive" size="18" class="archive-title__icon" />
          文章归档
        </h2>
        <p class="archive-title__sub">共 {{ totalCount }} 篇文章，持续记录中...</p>
      </div>

      <!-- 右侧操作区：仅搜索框 -->
      <div class="archive-actions">
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
/* 归档标题块 */
.archive-title__heading {
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.archive-title__icon {
  color: var(--text-soft);
}

.archive-title__sub {
  font-size: 0.875rem;
  color: var(--text-soft);
  margin-top: 0.25rem;
}

/* 右侧操作区 */
.archive-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding-bottom: 1rem;

  @media (min-width: $breakpoint-sm) {
    width: auto;
    padding-bottom: 0;
    margin-left: auto;
  }
}

/* 归档时间线滚动区 */
.archive-body {
  flex: 1;
  padding: 0;
}

:deep(.archive-viewport) {
  padding: 1.5rem 2rem 2rem;
}
</style>
