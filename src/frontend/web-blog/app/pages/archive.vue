<!--
  @file archive.vue
  @description 文章归档独立页面，按年份时间线展示全部文章并提供分类分布统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <CommonPageFrame class="main-inner archive-page" header-key="archive">
    <template #header>
      <div class="main-content__header">
        <div class="page-title">
          <div class="page-title__icon-wrap" aria-hidden="true">
            <Icon name="lucide:archive" size="18" />
          </div>
          <div class="page-title__text">
            <h2 class="page-title__heading">文章归档</h2>
            <p class="page-title__sub">
              {{
                metadata
                  ? `共 ${totalCount} 篇文章，持续记录中...`
                  : archivePending
                    ? '正在加载归档…'
                    : '归档暂时不可用'
              }}
            </p>
          </div>
        </div>

        <!-- 右侧操作区：仅搜索框 -->
        <div class="page-actions">
          <CommonSearchBox placeholder="搜索文章标题、内容..." readonly @click="openSearch" />
        </div>
      </div>
    </template>
    <template #default>
      <!-- 头部区域 -->
      <!-- 主内容：归档时间线 -->
      <CommonCustomScrollbar class="archive-body" viewport-class="archive-viewport" :show-back-to-top="false" primary>
        <CommonRequestFeedback
          v-if="archivePending || archiveError"
          :pending="archivePending"
          :compact="!!metadata"
          title="归档加载失败，请稍后重试"
          :description="metadata ? '仍显示上次成功加载的归档。' : '暂时无法获取归档内容。'"
          @retry="refreshArchive()"
        />
        <ArticleArchiveTimeline v-if="archiveYears.length" :years="archiveYears" />
        <CommonStateBlock
          v-else-if="!archivePending && !archiveError"
          icon="lucide:archive"
          title="暂无文章归档"
          description="文章发布后会显示在这里。"
        />
      </CommonCustomScrollbar>
      <!-- 右侧栏：归档统计 + 分类分布 -->
    </template>
    <template #overlays>
      <ClientOnly>
        <Teleport to="#right-sidebar-target">
          <SidebarRightSidebar>
            <ArticleArchiveStats v-if="metadata" :stats="archiveStats" :distribution="categoryDistribution" />
            <CommonRequestFeedback
              v-else
              class="card"
              compact
              :pending="archivePending"
              title="归档统计暂时不可用"
              @retry="refreshArchive()"
            />
          </SidebarRightSidebar>
        </Teleport>
      </ClientOnly>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
const {
  metadata,
  archiveYears,
  archiveStats,
  categoryDistribution,
  error: archiveError,
  pending: archivePending,
  refresh: refreshArchive,
} = await usePostMetadata()

// 累加各年文章数，避免依赖 mockPosts，保持数据源一致
const totalCount = computed(() => archiveYears.value.reduce((sum, year) => sum + year.count, 0))

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
