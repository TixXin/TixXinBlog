<!--
  @file index.vue
  @description 文章发现页：URL控制分页和筛选，朋友圈使用统一的独立入口
  @author TixXin
  @since 2025-03-17
-->
<template>
  <CommonPageFrame class="main-inner articles-page" header-key="feed">
    <template #header>
      <div class="main-content__header">
        <BlogPostTabs :tabs="tabs" model-value="all" />
        <div class="page-actions">
          <CommonSearchBox :placeholder="$t('article.home.searchPlaceholder')" readonly @click="openSearch" />
          <!-- 侧栏隐藏时（Dock、窄屏）由同一抽屉提供筛选与订阅，与侧栏内容一一对应，不会与订阅卡同时出现 -->
          <CommonContextDrawer
            class="page-context-entry"
            :label="$t('article.home.filterDrawer')"
            icon="lucide:list-filter"
          >
            <SidebarPostFilters
              :tags="tags"
              :categories="categories"
              :available="!!metadata"
              :pending="metadataPending"
              :error="!!metadataError"
              :active-tag="activeTagName"
              :active-category="selectedCategory"
              @select-tag="onTagSelect"
              @select-category="onCategorySelect"
              @retry="refreshMetadata()"
            />
            <button v-if="activeFilterLabel" type="button" class="filter-badge" @click="clearFilters">
              {{ $t('article.home.clearFilterWith', { filter: activeFilterLabel }) }}
            </button>
            <BlogSubscribeCard embedded />
          </CommonContextDrawer>
          <BlogPostDisplayModeToggle v-model="listDisplayMode" />
        </div>
      </div>
    </template>
    <template #default>
      <!-- 首页没有可见的页面标题，补一个仅供辅助技术与搜索引擎读取的 h1 -->
      <h1 class="sr-only">{{ siteSettings.name }}</h1>
      <BlogSetupWatermark />
      <div v-if="activeFilterLabel" class="articles-filter-summary">
        <span role="status">{{ $t('article.home.activeFilter', { filter: activeFilterLabel }) }}</span>
        <button
          type="button"
          class="filter-badge"
          :aria-label="$t('article.home.clearFilterWith', { filter: activeFilterLabel })"
          @click="clearFilters"
        >
          <Icon name="lucide:x" size="14" />{{ $t('article.home.clearFilter') }}
        </button>
      </div>
      <BlogPostCardList
        :posts="posts"
        :total="postTotal"
        :current-page="postPage"
        :pending="postsPending"
        :error-message="postsError ? $t('article.list.loadFailed') : ''"
        active-tab="all"
        :display-mode="listDisplayMode"
        :selected-tag="selectedTag"
        :selected-category="selectedCategory"
        @page="postPage = $event"
        @retry="retryArticles"
      />
    </template>
    <template #overlays>
      <!-- 右栏内容交给能力位门控组件：dock 未声明右栏时自然不渲染，无需在页面里判断主题 id -->
      <CommonThemeSidebarPortal>
        <SidebarRightSidebar>
          <SidebarPostFilters
            :tags="tags"
            :categories="categories"
            :available="!!metadata"
            :pending="metadataPending"
            :error="!!metadataError"
            :active-tag="activeTagName"
            :active-category="selectedCategory"
            @select-tag="onTagSelect"
            @select-category="onCategorySelect"
            @retry="refreshMetadata()"
          />
          <BlogSubscribeCard />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { mockPostTabs } from '~/features/post/mock'
import { isCanonicalPageParam } from '~/features/post/listQuery'
import { useHomeSeo } from '~/features/post/useHomeSeo'

const route = useRoute()
// 目录在下方与文章并行读取。标题先注册，目录返回后再把 slug 换成标签名称。
const postSummary = shallowRef<{ tags: Array<{ label: string; slug: string }> } | null>(null)
const { siteSettings } = useHomeSeo({ postSummary })

const tabs = mockPostTabs
const {
  page: postPage,
  selectedTag,
  selectedCategory,
  displayMode: listDisplayMode,
  clearFilters,
  replacePage,
} = usePostListRoute()
const metadataTask = usePostMetadata()
const postsTask = usePostList({
  page: postPage,
  selectedTag,
  selectedCategory,
  displayMode: listDisplayMode,
  resetOnScopeChange: false,
})
const [metadataResult, postsResult] = await Promise.all([metadataTask, postsTask])
const {
  metadata,
  tags,
  categories,
  pending: metadataPending,
  error: metadataError,
  refresh: refreshMetadata,
} = metadataResult
const { posts, total: postTotal, pending: postsPending, error: postsError, refresh: refreshPosts } = postsResult
// 接口按 slug 筛选，卡片仍展示标签名称；保留元数据与文章的首屏并行读取。
const activeTagName = computed(
  () => metadata.value?.tags.find((tag) => tag.slug === selectedTag.value)?.label ?? selectedTag.value,
)
watch(
  metadata,
  (value) => {
    postSummary.value = value ?? null
  },
  { immediate: true },
)
const activeFilterLabel = computed(() => [selectedCategory.value, activeTagName.value].filter(Boolean).join(' · '))
async function retryArticles() {
  if (postsPending.value) return
  await Promise.all([refreshPosts(), ...(metadataError.value ? [refreshMetadata()] : [])])
}
function onTagSelect(tag: string) {
  const slug = metadata.value?.tags.find((item) => item.label === tag)?.slug ?? tag
  selectedTag.value = activeTagName.value === tag ? null : slug
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
// 0、abc 等非规范页码已按第 1 页显示，挂载后用 replace 纠正地址栏；SSR 与水合期间不改写 URL
onMounted(() => {
  if (!isCanonicalPageParam(route.query.page, postPage.value)) void replacePage(postPage.value)
})

// 旧分享链接仍可使用，进入后归一到同一朋友圈页面和数据源。
function migrateMomentHash() {
  if (route.hash === '#moments') void navigateTo({ path: '/moments', query: route.query }, { replace: true })
}
onMounted(migrateMomentHash)
watch(() => route.hash, migrateMomentHash)
</script>
<style lang="scss" scoped>
// 窄屏下筛选入口只留图标，文字仅供读屏，让搜索、筛选和显示模式保持同一行
@media (max-width: #{$breakpoint-sm - 1px}) {
  .page-context-entry :deep(.context-entry__button) {
    width: 44px;
    padding: 0;

    > span:last-child {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
  }
  .page-actions .search-box {
    flex-basis: 6rem;
    min-width: 6rem;
  }
}
.articles-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  // 左右留白与下方文章列表视口（PostCardList 的 .post-list-viewport）各断点保持一致
  padding: 0.75rem 1rem 0;
  font-size: 0.8125rem;
  color: var(--text-soft);

  @media (min-width: $breakpoint-sm) {
    padding: 0.75rem 1.5rem 0;
  }

  @media (min-width: $breakpoint-lg) and (max-width: #{$breakpoint-xl - 1px}) {
    padding: 0.75rem 1.25rem 0;
  }

  @media (min-width: $breakpoint-xl) {
    padding: 0.75rem 2rem 0;
  }
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
  cursor: var(--interaction-cursor, pointer);
  @media (pointer: coarse) {
    min-height: 44px;
  }
}
</style>
