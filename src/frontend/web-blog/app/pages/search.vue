<!-- @file search.vue @description 可分享和返回的六域公开搜索；分组预览与单类型服务端分页。 -->
<template>
  <CommonPageFrame class="main-inner" header-key="search">
    <template #header>
      <CommonPageHeader
        :title="$t('article.search.title')"
        :subtitle="$t('article.search.subtitle')"
        icon="lucide:search"
      />
    </template>
    <template #default>
      <CommonCustomScrollbar class="search-page" viewport-class="search-page__viewport" primary>
        <form class="search-page__form" @submit.prevent="submit">
          <input
            ref="inputRef"
            v-model="keyword"
            type="search"
            :aria-label="$t('article.search.inputLabel')"
            :placeholder="$t('article.search.placeholder')"
            maxlength="200"
            :aria-describedby="keyboardHintId"
            @keydown="onInputKeydown"
          />
          <button type="submit">{{ $t('article.search.submit') }}</button>
        </form>
        <nav class="search-page__types" :aria-label="$t('article.search.typesLabel')">
          <NuxtLink
            v-for="scope in searchScopes"
            :key="scope"
            :to="searchLocation(activeQuery, scope)"
            :aria-current="activeType === scope ? 'page' : undefined"
            >{{ searchTypeLabel(scope, t) }}</NuxtLink
          >
        </nav>
        <p class="search-page__scope">{{ $t('article.search.scope') }}</p>
        <p :id="keyboardHintId" class="search-page__keyboard">
          {{ $t('article.search.keyboardHint') }}
        </p>
        <p v-if="!activeQuery.trim()">{{ $t('article.search.emptyQuery') }}</p>
        <template v-else>
          <CommonRequestFeedback
            v-if="!mounted || isSearching || error"
            :pending="!mounted || isSearching"
            :compact="groups.length > 0"
            :title="$t('article.search.loadFailed')"
            :description="error || undefined"
            @retry="refresh"
          />
          <div v-if="mounted && !isSearching" ref="resultListRef" @keydown="onResultKeydown">
            <p v-if="activeType === 'all'">{{ $t('article.search.previewHint', { count: SEARCH_PREVIEW_SIZE }) }}</p>
            <section
              v-for="group in groups"
              :key="group.type"
              class="search-page__group"
              :data-search-type="group.type"
            >
              <header>
                <h2>{{ searchTypeLabel(group.type, t) }}</h2>
                <span v-if="group.total !== null">{{
                  $t('article.search.itemCount', { count: group.total }, group.total)
                }}</span>
                <NuxtLink
                  v-if="activeType === 'all' && group.total !== null && group.total > group.items.length"
                  :to="searchLocation(activeQuery, group.type)"
                  >{{ $t('article.search.viewAll', { type: searchTypeLabel(group.type, t) }) }}</NuxtLink
                >
              </header>
              <p v-if="group.unavailable" role="status">{{ $t('article.search.sourceUnavailable') }}</p>
              <p v-else-if="!group.items.length">{{ $t('article.search.noResults') }}</p>
              <ul v-else>
                <li v-for="item in group.items" :key="item.id">
                  <a
                    v-if="item.type === 'link'"
                    :href="item.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-search-result
                  >
                    <Icon :name="item.icon" aria-hidden="true" /><SearchHighlight
                      :text="item.title"
                      :keyword="activeQuery"
                    /><Icon name="lucide:external-link" aria-hidden="true" />
                    <span class="sr-only">{{ $t('article.search.newTab') }}</span>
                  </a>
                  <NuxtLink v-else :to="item.url" data-search-result
                    ><Icon :name="item.icon" aria-hidden="true" /><SearchHighlight
                      :text="item.title"
                      :keyword="activeQuery"
                  /></NuxtLink>
                  <p><SearchHighlight :text="item.description" :keyword="activeQuery" /></p>
                </li>
              </ul>
            </section>
          </div>
          <nav
            v-if="
              !isSearching && activeType !== 'all' && total !== null && (total > SEARCH_PAGE_SIZE || activePage > 1)
            "
            class="search-page__pagination"
            :aria-label="$t('article.search.paginationLabel')"
          >
            <NuxtLink v-if="activePage > 1" :to="searchLocation(activeQuery, activeType, activePage - 1)">{{
              $t('article.pagination.previous')
            }}</NuxtLink>
            <span role="status">{{ $t('article.search.pageStatus', { page: activePage, total }, total) }}</span>
            <NuxtLink
              v-if="activePage * SEARCH_PAGE_SIZE < total"
              :to="searchLocation(activeQuery, activeType, activePage + 1)"
              >{{ $t('article.pagination.next') }}</NuxtLink
            >
          </nav>
        </template>
      </CommonCustomScrollbar>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import SearchHighlight from '~/components/common/SearchHighlight.vue'
import { searchLocation, searchScope, searchPage } from '~/features/search/query'
import { searchTypeLabel, searchTypeLabelKeys, SEARCH_PAGE_SIZE, SEARCH_PREVIEW_SIZE } from '~/features/search/types'
import type { SearchScope } from '~/features/search/types'
import { useSearchPageKeyboard } from '~/features/search/useSearchPageKeyboard'

// 搜索页没有右侧栏内容，不保留空白的侧栏占位
definePageMeta({ rightSidebar: false })
const route = useRoute(),
  router = useRouter()
const activeQuery = computed(() => (typeof route.query.q === 'string' ? route.query.q.slice(0, 200) : ''))
const activeType = computed(() => searchScope(route.query.type))
const activePage = computed(() => (activeType.value === 'all' ? 1 : searchPage(route.query.page)))
const keyword = ref(activeQuery.value),
  mounted = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const resultListRef = ref<HTMLElement | null>(null)
const keyboardHintId = useId()
const { groups, total, isSearching, error, search, cancel } = useSearch()
const { t } = useI18n()
const searchScopes = Object.keys(searchTypeLabelKeys) as SearchScope[]
usePageSeo({
  title: () => t('article.search.title'),
  robots: 'noindex, follow',
  description: () => t('article.search.seoDescription'),
})

const { onInputKeydown, onResultKeydown, restoreFocusToInput } = useSearchPageKeyboard({
  inputRef,
  resultListRef,
  keyword,
  activeQuery,
  isSearching,
})

function submit() {
  const location = searchLocation(keyword.value, activeType.value)
  if (router.resolve(location).fullPath === route.fullPath) void refresh()
  else void router.push(location)
}

async function refresh() {
  const path = route.fullPath
  // 刷新移除当前结果前归还焦点，避免键盘用户落到页面之外。
  restoreFocusToInput()
  await search(activeQuery.value, activeType.value, activePage.value)
  if (route.fullPath !== path || error.value || total.value === null || activeType.value === 'all') return
  const lastPage = Math.max(1, Math.ceil(total.value / SEARCH_PAGE_SIZE))
  if (activePage.value > lastPage) await router.replace(searchLocation(activeQuery.value, activeType.value, lastPage))
}

watch(
  () => route.fullPath,
  () => {
    if (route.path !== '/search') {
      cancel()
      return
    }
    keyword.value = activeQuery.value
    if (mounted.value) void refresh()
  },
)

onMounted(() => {
  mounted.value = true
  void refresh()
})
</script>
<style scoped lang="scss">
.search-page {
  flex: 1;
  min-height: 0;
}
:deep(.search-page__viewport) {
  padding: 1.5rem 2rem 2rem;
}
.search-page__form,
.search-page__types,
.search-page__pagination,
.search-page__group header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.search-page__form input {
  flex: 1;
  min-width: 0;
}
.search-page__form input,
button,
.search-page__types a,
.search-page__pagination a {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
.search-page__types a,
.search-page__pagination a {
  display: inline-flex;
  align-items: center;
}
[aria-current='page'] {
  border-color: var(--accent);
  color: var(--accent-text);
}
.search-page__scope,
p,
header span {
  color: var(--text-muted);
  margin: 0.75rem 0;
}
.search-page__group {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  padding: 0.75rem 0;
  border-top: 1px solid var(--border);
}
li a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
}
li a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 0.25rem;
}
.search-highlight {
  min-width: 0;
}
a {
  /* 文字使用 accent-text：暗色模式下 accent 压在卡片面上对比度不足 4.5:1 */
  color: var(--accent-text);
  overflow-wrap: anywhere;
}
p {
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  :deep(.search-page__viewport) {
    padding: 1rem 0.75rem;
  }
}
</style>
