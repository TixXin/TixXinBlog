<!--
  @file index.vue
  @description 博客首页，支持全部文章与朋友圈两个 Tab 视图，文章列表支持标签/分类过滤
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner articles-page">
    <!-- 头部区域 -->
    <div class="main-content__header">
      <Transition name="tab-fade" mode="out-in">
        <!-- 归档模式：标题 -->
        <div v-if="activeTab === 'all' && viewMode === 'archive'" key="archive-title" class="articles-title">
          <h2 class="articles-title__heading">
            <Icon name="lucide:archive" size="18" class="articles-title__icon" />
            文章归档
          </h2>
          <p class="articles-title__sub">共 {{ posts.length }} 篇文章，持续记录中...</p>
        </div>

        <!-- Tab 栏：全部文章与朋友圈共用，切换时不触发过渡 -->
        <div v-else key="tabs" class="articles-tabs no-scrollbar" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            role="tab"
            :aria-selected="activeTab === tab.value"
            class="tab-btn"
            :class="{ 'tab-active': activeTab === tab.value }"
            @click="switchTab(tab.value)"
          >
            {{ tab.label }}
          </button>

          <!-- 当前过滤条件标签 -->
          <Transition name="filter-fade">
            <span v-if="activeFilterLabel && activeTab === 'all'" class="filter-badge" @click="clearFilters">
              <Icon name="lucide:filter" size="12" />
              {{ activeFilterLabel }}
              <Icon name="lucide:x" size="12" class="filter-badge__close" />
            </span>
          </Transition>
        </div>
      </Transition>

      <!-- 右侧操作区：仅在文章相关视图显示 -->
      <div v-if="activeTab === 'all'" class="articles-actions">
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

    <Transition name="tab-fade" mode="out-in">
      <!-- 列表模式：文章卡片列表 -->
      <BlogPostCardList
        v-if="activeTab === 'all' && viewMode === 'list'"
        key="list"
        :posts="posts"
        active-tab="all"
        :display-mode="listDisplayMode"
        :selected-tag="selectedTag"
        :selected-category="selectedCategory"
      />

      <!-- 归档模式：时间线 -->
      <CommonCustomScrollbar
        v-else-if="activeTab === 'all' && viewMode === 'archive'"
        key="archive"
        class="articles-body"
        viewport-class="articles-viewport"
        :show-back-to-top="false"
        primary
      >
        <ArticleArchiveTimeline :years="archiveYears" />
      </CommonCustomScrollbar>

      <!-- 朋友圈 Tab -->
      <CommonCustomScrollbar
        v-else
        key="moments"
        class="moments-body"
        viewport-class="moments-viewport"
        :show-back-to-top="false"
        primary
      >
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
    </Transition>

    <!-- 右侧栏 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <Transition :name="sidebarTransitionName" mode="out-in">
            <!-- 文章列表侧栏 -->
            <div v-if="activeTab === 'all' && viewMode === 'list'" key="sidebar-list" class="sidebar-list-group">
              <SidebarTagCloudCard :tags="tags" :active-tag="selectedTag" @select="onTagSelect" />
              <SidebarCategoryCard :categories="categories" :active-category="selectedCategory" @select="onCategorySelect" />
            </div>

            <!-- 归档侧栏 -->
            <ArticleArchiveStats
              v-else-if="activeTab === 'all' && viewMode === 'archive'"
              key="sidebar-archive"
              :stats="archiveStats"
              :distribution="categoryDistribution"
            />

            <!-- 朋友圈侧栏 -->
            <div v-else key="sidebar-moments" class="sidebar-list-group">
              <SidebarMomentAuthorCard :stats="authorStats" />
              <SidebarMomentCalendarCard :moment-dates="momentDates" />
              <SidebarMomentTopicCard :topics="momentTopics" />
            </div>
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
import { mockMoments } from '~/features/moment/mock'
import type { MomentAuthorStats } from '~/components/sidebar/MomentAuthorCard.vue'
import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'

useSeoMeta({
  title: '首页',
  description: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
  ogTitle: '首页 - TixXin Blog',
  ogDescription: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
})

const { sidebarTransitionName } = useAppearanceSettings()
const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}

// ---- 视图状态 ----
const activeTab = ref('all')
const viewMode = ref<'list' | 'archive'>('list')
const listDisplayMode = ref<'waterfall' | 'pagination'>('pagination')

// ---- 文章数据 ----
const tabs = mockPostTabs
const posts = mockPosts
const tags = mockTags
const categories = mockCategories
const archiveYears = mockArchiveYears
const archiveStats = mockArchiveStats
const categoryDistribution = mockCategoryDistribution

// ---- 朋友圈数据 ----
const moments = computed(() => mockMoments)

const authorStats: MomentAuthorStats = {
  totalMoments: mockMoments.length,
  totalLikes: mockMoments.reduce((sum, m) => sum + m.likes, 0),
  totalDays: 128,
  currentMood: '今天阳光正好，适合写代码 🌞',
}

const momentDates = computed(() => mockMoments.map(m => m.date.slice(0, 10)))

const momentTopics: MomentTopic[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', count: 24, description: '记录每一天的小确幸' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', count: 18, description: '代码与灵感的碰撞' },
  { name: '读书笔记', icon: 'lucide:book-open', color: '#8b5cf6', count: 12, description: '阅读中的思考片段' },
  { name: '摄影记录', icon: 'lucide:camera', color: '#ec4899', count: 9, description: '用镜头捕捉瞬间' },
  { name: '美食探店', icon: 'lucide:utensils', color: '#ef4444', count: 7, description: '味蕾的冒险旅程' },
]

// ---- 标签/分类过滤 ----
const selectedTag = ref<string | null>(null)
const selectedCategory = ref<string | null>(null)

const activeFilterLabel = computed(() => {
  if (selectedTag.value && selectedCategory.value) {
    return `${selectedCategory.value} · ${selectedTag.value}`
  }
  if (selectedTag.value) return selectedTag.value
  if (selectedCategory.value) return selectedCategory.value
  return null
})

function onTagSelect(tagName: string) {
  // 切到文章 tab
  if (activeTab.value !== 'all') switchTab('all')
  // 再次点击取消选中
  selectedTag.value = selectedTag.value === tagName ? null : tagName
}

function onCategorySelect(categoryName: string) {
  if (activeTab.value !== 'all') switchTab('all')
  selectedCategory.value = selectedCategory.value === categoryName ? null : categoryName
}

function clearFilters() {
  selectedTag.value = null
  selectedCategory.value = null
}

function switchTab(value: string) {
  activeTab.value = value
  if (value === 'moments') {
    clearFilters()
    viewMode.value = 'list'
  }
}
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

/* ---- 过滤条件标签 ---- */
.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}

.filter-badge__close {
  opacity: 0.6;

  .filter-badge:hover & {
    opacity: 1;
  }
}

/* ---- Tab 内容区过渡动画 ---- */
.tab-fade-enter-active {
  transition: opacity 0.2s ease;
}

.tab-fade-leave-active {
  transition: opacity 0.15s ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}

.filter-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.filter-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.filter-fade-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.filter-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ---- 朋友圈内嵌样式 ---- */
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

.moments-header {
  margin-bottom: 1.5rem;
}

.moments-header__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.moments-header__icon {
  color: var(--accent);
}

.moments-header__sub {
  font-size: 0.875rem;
  color: var(--text-soft);
  margin-top: 0.25rem;
}
</style>
