<!--
  @file index.vue
  @description 文章列表页，按 Tab 切换分类并支持瀑布流/分页两种显示模式
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner articles-page">
    <!-- 头部区域 -->
    <div class="main-content__header">
      <!-- Tab 栏 -->
      <div class="articles-tabs no-scrollbar" role="tablist">
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

      <!-- 右侧操作区：搜索 + 显示模式切换 -->
      <div class="articles-actions">
        <CommonSearchBox placeholder="搜索站内文章、标签..." readonly @click="openSearch" />
        <div class="display-mode-toggle">
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
      </div>
    </div>

    <!-- 文章卡片列表 -->
    <BlogPostCardList :posts="posts" :active-tab="activeTab" :display-mode="listDisplayMode" />

    <!-- 右侧栏 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <div class="sidebar-list-group">
            <SidebarTagCloudCard :tags="tags" />
            <SidebarCategoryCard :categories="categories" />
          </div>
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockPosts, mockPostTabs } from '~/features/post/mock'
import { mockTags, mockCategories } from '~/features/stats/mock'

useSeoMeta({
  title: '文章',
  description: '浏览全部技术文章与生活随笔，支持分类筛选',
  ogTitle: '文章 - TixXin Blog',
  ogDescription: '浏览全部技术文章与生活随笔，支持分类筛选',
})

const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}

const activeTab = ref('all')
const listDisplayMode = ref<'waterfall' | 'pagination'>('waterfall')

const tabs = mockPostTabs
const posts = mockPosts
const tags = mockTags
const categories = mockCategories
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

/* 显示模式按钮组 */
.display-mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  overflow: hidden;
  flex-shrink: 0;
}

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

/* 侧栏列表组容器，与 RightSidebar 的 gap 保持一致 */
.sidebar-list-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
