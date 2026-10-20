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
          <div class="display-mode-toggle" role="group" :aria-label="$t('article.home.displayMode')">
            <CommonTooltip :content="$t('article.home.waterfall')">
              <button
                type="button"
                :aria-label="$t('article.home.waterfall')"
                :aria-pressed="listDisplayMode === 'waterfall'"
                class="display-mode-toggle__btn"
                :class="{ 'display-mode-toggle__btn--active': listDisplayMode === 'waterfall' }"
                @click="listDisplayMode = 'waterfall'"
              >
                <Icon name="lucide:scroll-text" size="15" />
              </button>
            </CommonTooltip>
            <CommonTooltip :content="$t('article.home.pagination')">
              <button
                type="button"
                :aria-label="$t('article.home.pagination')"
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
    </template>
    <template #default>
      <!-- 首页没有可见的页面标题，补一个仅供辅助技术与搜索引擎读取的 h1 -->
      <h1 class="sr-only">{{ siteSettings.name }}</h1>
      <!-- 只在尚无博主账号时于浏览器端显示，不进入服务端渲染与页面缓存；初始化完成后自动消失 -->
      <p v-if="setupPending" class="setup-pending" role="status">
        <Icon name="lucide:wand-sparkles" size="16" aria-hidden="true" />
        <span>{{ $t('article.home.setupPending') }}</span>
        <NuxtLink to="/admin/login">{{ $t('article.home.setupPendingLink') }}</NuxtLink>
      </p>
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
      <Teleport to="#right-sidebar-target">
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
      </Teleport>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { mockPostTabs } from '~/features/post/mock'
import { isCanonicalPageParam, readPostListQuery, writePostListQuery } from '~/features/post/listQuery'
import { socialProfiles } from '~/utils/absoluteUrl'

const { settings: siteSettings } = useSiteSettings()
const route = useRoute()
const siteUrl = useSiteUrl()
const homeTitle = computed(() => siteSettings.value.seoTitle || siteSettings.value.name)
const homeDescription = computed(() => siteSettings.value.seoDescription || siteSettings.value.description)
const homeImage = useDefaultShareImage()
const { t, locale } = useI18n()
// 目录在下方与文章并行读取。标题先注册，目录返回后再把 slug 换成标签名称。
const postSummary = shallowRef<{ tags: Array<{ label: string; slug: string }> } | null>(null)
// 分页与筛选页采用「自引用 canonical + 区分标题」：每页内容不同，不统一指向第一页；
// canonical 只保留 category/tag/page 三个规范参数，去掉显示模式与跟踪参数。
const listSeo = computed(() => {
  const { page, tag, category } = readPostListQuery(route.query)
  const tagLabel = postSummary.value?.tags.find((item) => item.slug === tag)?.label ?? tag
  const label = [
    category ? t('article.home.seoCategory', { name: category }) : '',
    tagLabel ? t('article.home.seoTag', { name: tagLabel }) : '',
    page > 1 ? t('article.pagination.page', { page }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const search = new URLSearchParams(writePostListQuery({ page, tag, category, mode: 'pagination' })).toString()
  return { label, canonical: `/${search ? `?${search}` : ''}` }
})
usePageSeo({
  title: () => listSeo.value.label || homeTitle.value,
  shareTitle: () => (listSeo.value.label ? `${listSeo.value.label} - ${siteSettings.value.name}` : homeTitle.value),
  description: () => homeDescription.value,
  type: 'website',
  canonical: () => listSeo.value.canonical,
})
useJsonLd('home', () => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: siteSettings.value.name,
      ...(homeDescription.value ? { description: homeDescription.value } : {}),
      inLanguage: locale.value,
      publisher: { '@id': `${siteUrl}/#person` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Person',
      '@id': `${siteUrl}/#person`,
      name: siteSettings.value.ownerName || siteSettings.value.name,
      url: `${siteUrl}/about`,
      ...(siteSettings.value.ownerTitle ? { jobTitle: siteSettings.value.ownerTitle } : {}),
      ...(homeImage.value ? { image: homeImage.value.url } : {}),
      ...(socialProfiles(siteSettings.value.socials).length
        ? { sameAs: socialProfiles(siteSettings.value.socials) }
        : {}),
    },
  ],
}))
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
// 新装站点首页没有任何内容，提示博主用安装时输出的链接完成初始化；读取失败时不显示
const setupPending = ref(false)
const fetchSetupStatus = useSetupStatus()
const preview = useDevPreview()
async function readSetupPending() {
  try {
    // 开发模式下 ?preview=setup-pending 直接显示提示，便于调整样式；生产构建中不生效
    setupPending.value = preview('setup-pending') || (await fetchSetupStatus())
  } catch {
    setupPending.value = false
  }
}
onMounted(readSetupPending)
// 调试面板在同一页面切换或退出预览时只改地址参数，需要重新判定
if (import.meta.dev) watch(() => preview('setup-pending'), readSetupPending)
watch(() => route.hash, migrateMomentHash)
</script>
<style lang="scss" scoped>
.setup-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.5rem;
  align-items: center;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.setup-pending a {
  color: var(--accent);
}
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
  cursor: var(--interaction-cursor, pointer);
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
