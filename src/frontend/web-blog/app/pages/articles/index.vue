<!--
  @file index.vue
  @description 文章页面，支持列表与归档两种视图模式切换
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner articles-page">
    <!-- 头部区域 -->
    <div class="main-content__header">
      <Transition :name="contentTransitionName" mode="out-in">
        <!-- 列表模式：Tab 栏 -->
        <div v-if="viewMode === 'list'" key="tabs" class="articles-tabs no-scrollbar" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            role="tab"
            :aria-selected="activeTab === tab.value"
            :aria-controls="`panel-${tab.value}`"
            class="tab-btn"
            :class="{ 'tab-active': activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- 归档模式：标题 -->
        <div v-else key="archive-title" class="articles-title">
          <h2 class="articles-title__heading">
            <Icon name="lucide:archive" size="18" class="articles-title__icon" />
            文章归档
          </h2>
          <p class="articles-title__sub">共 {{ posts.length }} 篇文章，持续记录中...</p>
        </div>
      </Transition>

      <!-- 右侧操作区：搜索 + 显示模式 + 视图切换 -->
      <div class="articles-actions">
        <CommonSearchBox
          :placeholder="viewMode === 'list' ? '搜索站内文章、标签...' : '搜索文章标题、内容...'"
          readonly
          @click="openSearch"
        />
        <div v-if="viewMode === 'list'" class="display-mode-toggle">
          <CommonTooltip content="瀑布流">
            <button
              class="display-mode-toggle__btn"
              :class="{ 'display-mode-toggle__btn--active': listDisplayMode === 'waterfall' }"
              @click="listDisplayMode = 'waterfall'"
            >
              <Icon name="lucide:scroll-text" size="15" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="分页显示">
            <button
              class="display-mode-toggle__btn"
              :class="{ 'display-mode-toggle__btn--active': listDisplayMode === 'pagination' }"
              @click="listDisplayMode = 'pagination'"
            >
              <Icon name="lucide:book-open" size="15" />
            </button>
          </CommonTooltip>
        </div>
        <div class="view-toggle">
          <CommonTooltip content="列表视图">
            <button
              class="view-toggle__btn"
              :class="{ 'view-toggle__btn--active': viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              <Icon name="lucide:layout-list" size="15" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="归档视图">
            <button
              class="view-toggle__btn"
              :class="{ 'view-toggle__btn--active': viewMode === 'archive' }"
              @click="viewMode = 'archive'"
            >
              <Icon name="lucide:calendar-clock" size="15" />
            </button>
          </CommonTooltip>
        </div>
      </div>
    </div>

    <Transition :name="contentTransitionName" mode="out-in">
      <!-- 列表模式：文章卡片列表 -->
      <BlogPostCardList
        v-if="viewMode === 'list'"
        key="list"
        :posts="posts"
        :active-tab="activeTab"
        :display-mode="listDisplayMode"
      />

      <!-- 归档模式：时间线 -->
      <CommonCustomScrollbar
        v-else
        key="archive"
        class="articles-body"
        viewport-class="articles-viewport"
        show-back-to-top
      >
        <ArticleArchiveTimeline :years="archiveYears" />
      </CommonCustomScrollbar>
    </Transition>

    <!-- 右侧栏 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <Transition :name="sidebarTransitionName" mode="out-in">
            <div v-if="viewMode === 'list'" key="sidebar-list" class="sidebar-list-group">
              <SidebarTagCloudCard :tags="tags" />
              <SidebarCategoryCard :categories="categories" />
            </div>
            <ArticleArchiveStats
              v-else
              key="sidebar-archive"
              :stats="archiveStats"
              :distribution="categoryDistribution"
            />
          </Transition>
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockPosts, mockPostTabs } from '~/features/post/mock'
import { mockTags, mockCategories } from '~/features/stats/mock'
import { mockArchiveStats, mockArchiveYears, mockCategoryDistribution } from '~/features/article/mock'

useSeoMeta({
  title: '文章',
  description: '浏览全部技术文章与生活随笔，支持分类筛选与归档视图',
  ogTitle: '文章 - TixXin Blog',
  ogDescription: '浏览全部技术文章与生活随笔，支持分类筛选与归档视图',
})

const { contentTransitionName, sidebarTransitionName } = useAppearanceSettings()
const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}

const viewMode = ref<'list' | 'archive'>('list')
const activeTab = ref('all')
const listDisplayMode = ref<'waterfall' | 'pagination'>('waterfall')

const tabs = mockPostTabs
const posts = mockPosts
const tags = mockTags
const categories = mockCategories
const archiveYears = mockArchiveYears
const archiveStats = mockArchiveStats
const categoryDistribution = mockCategoryDistribution
</script>

<style lang="scss" scoped>
/* Tab 栏布局 */
.articles-tabs {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  overflow-x: auto;

  @media (min-width: $breakpoint-sm) {
    gap: 2.5rem;
  }
}

/* 归档标题 */
.articles-title__heading {
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.articles-title__icon {
  color: var(--text-soft);
}

.articles-title__sub {
  font-size: 0.875rem;
  color: var(--text-soft);
  margin-top: 0.25rem;
}

/* 右侧操作区 */
.articles-actions {
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

/* 按钮组通用基础样式 */
.view-toggle,
.display-mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  overflow: hidden;
  flex-shrink: 0;
}

.view-toggle__btn,
.display-mode-toggle__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--text-soft);
  background: transparent;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &--active {
    color: var(--text-main);
    background: var(--surface-3);
  }

  & + & {
    border-left: 1px solid var(--border);
  }
}

/* 归档模式内容区 */
.articles-body {
  flex: 1;
  padding: 0;
}

:deep(.articles-viewport) {
  padding: 1.5rem 2rem 2rem;
}

/* 侧栏列表组容器，与 RightSidebar 的 gap 保持一致 */
.sidebar-list-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
