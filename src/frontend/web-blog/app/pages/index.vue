<!--
  @file index.vue
  @description 文章发现页：URL控制分页和筛选，朋友圈使用统一的独立入口
  @author TixXin
  @since 2025-03-17
-->
<template>
  <div class="main-inner articles-page">
    <div class="main-content__header">
      <div class="articles-header-left">
        <div class="page-title__icon-wrap" aria-hidden="true"><Icon name="lucide:newspaper" size="18" /></div>
        <nav class="articles-tabs" aria-label="内容类型">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.value"
            :to="tab.value === 'moments' ? '/moments' : '/'"
            class="tab-btn"
            :class="{ 'tab-active': tab.value === 'all' }"
            :aria-current="tab.value === 'all' ? 'page' : undefined"
          >
            {{ tab.label }}
          </NuxtLink>
        </nav>
      </div>
      <div class="page-actions">
        <CommonSearchBox placeholder="搜索站内文章、标签..." readonly @click="openSearch" />
        <CommonContextDrawer class="page-context-entry" label="筛选文章" icon="lucide:list-filter">
          <SidebarTagCloudCard :tags="tags" :active-tag="selectedTag" @select="onTagSelect" />
          <SidebarCategoryCard
            :categories="categories"
            :active-category="selectedCategory"
            @select="onCategorySelect"
          />
          <button v-if="activeFilterLabel" type="button" class="filter-badge" @click="clearFilters">
            清除筛选：{{ activeFilterLabel }}
          </button>
        </CommonContextDrawer>
        <div class="display-mode-toggle" role="group" aria-label="文章列表显示模式">
          <CommonTooltip content="连续加载">
            <button
              type="button"
              aria-label="连续加载"
              :aria-pressed="listDisplayMode === 'waterfall'"
              class="display-mode-toggle__btn"
              :class="{ 'display-mode-toggle__btn--active': listDisplayMode === 'waterfall' }"
              @click="listDisplayMode = 'waterfall'"
            >
              <Icon name="lucide:scroll-text" size="15" />
            </button>
          </CommonTooltip>
          <CommonTooltip content="分页显示">
            <button
              type="button"
              aria-label="分页显示"
              :aria-pressed="listDisplayMode === 'pagination'"
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
    <div v-if="activeFilterLabel" class="articles-filter-summary">
      <span role="status">当前筛选：{{ activeFilterLabel }}</span>
      <button type="button" class="filter-badge" :aria-label="`清除筛选：${activeFilterLabel}`" @click="clearFilters">
        <Icon name="lucide:x" size="14" />清除筛选
      </button>
    </div>
    <BlogPostCardList
      :posts="posts"
      :total="postTotal"
      :current-page="postPage"
      :pending="postsPending"
      :error-message="postsError ? '文章加载失败，请重试' : ''"
      active-tab="all"
      :display-mode="listDisplayMode"
      :selected-tag="selectedTag"
      :selected-category="selectedCategory"
      @page="postPage = $event"
      @retry="refreshPosts()"
    />
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarTagCloudCard :tags="tags" :active-tag="selectedTag" @select="onTagSelect" />
          <SidebarCategoryCard
            :categories="categories"
            :active-category="selectedCategory"
            @select="onCategorySelect"
          />
          <BlogSubscribeCard />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>
<script setup lang="ts">
import { mockPostTabs } from '~/features/post/mock'

const { settings: siteSettings } = useSiteSettings()
useSeoMeta({
  title: () => siteSettings.value.seoTitle || siteSettings.value.name,
  description: () => siteSettings.value.seoDescription || siteSettings.value.description,
  ogTitle: () => siteSettings.value.seoTitle || siteSettings.value.name,
  ogDescription: () => siteSettings.value.seoDescription || siteSettings.value.description,
})
const route = useRoute()
const tabs = mockPostTabs
const {
  page: postPage,
  selectedTag,
  selectedCategory,
  displayMode: listDisplayMode,
  clearFilters,
  replacePage,
} = usePostListRoute()
const { tags, categories } = await usePostMetadata()
const {
  posts,
  total: postTotal,
  pending: postsPending,
  error: postsError,
  refresh: refreshPosts,
} = await usePostList({
  page: postPage,
  selectedTag,
  selectedCategory,
  displayMode: listDisplayMode,
  resetOnScopeChange: false,
})
const activeFilterLabel = computed(() => [selectedCategory.value, selectedTag.value].filter(Boolean).join(' · '))
function onTagSelect(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}
function onCategorySelect(category: string) {
  selectedCategory.value = selectedCategory.value === category ? null : category
}
const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}
watch(
  [postTotal, postsPending, postsError],
  () => {
    if (postsPending.value || postsError.value) return
    const lastPage = Math.max(1, Math.ceil(postTotal.value / 15))
    if (postPage.value > lastPage) void replacePage(lastPage)
  },
  { immediate: true },
)

// 旧分享链接仍可使用，进入后归一到同一朋友圈页面和数据源。
function migrateMomentHash() {
  if (route.hash === '#moments') void navigateTo({ path: '/moments', query: route.query }, { replace: true })
}
onMounted(migrateMomentHash)
watch(() => route.hash, migrateMomentHash)
</script>
<style lang="scss" scoped>
.articles-header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}
.articles-tabs {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 0;
}
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
  width: 44px;
  height: 44px;
  color: var(--text-soft);
  background: transparent;
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
.articles-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  color: var(--text-soft);
}
.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 32px;
  padding: 0.25rem 0.625rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.8125rem;
  cursor: pointer;
  @media (pointer: coarse) {
    min-height: 44px;
  }
}
</style>
