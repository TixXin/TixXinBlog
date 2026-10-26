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
            <SearchPageResultGroup
              v-for="group in groups"
              :key="group.type"
              :group="group"
              :active-type="activeType"
              :keyword="activeQuery"
            />
          </div>
          <SearchPagePagination
            v-if="
              !isSearching && activeType !== 'all' && total !== null && (total > SEARCH_PAGE_SIZE || activePage > 1)
            "
            :keyword="activeQuery"
            :type="activeType"
            :page="activePage"
            :total="total"
          />
        </template>
      </CommonCustomScrollbar>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
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
@use '~/assets/styles/search-page' as search;

.search-page {
  flex: 1;
  min-height: 0;
}
:deep(.search-page__viewport) {
  padding: 1.5rem 2rem 2rem;
}
.search-page__form,
.search-page__types {
  @include search.bar;
}
.search-page__form input {
  flex: 1;
  min-width: 0;
}
.search-page__form input,
button,
.search-page__types a {
  @include search.control;
}
.search-page__types a {
  @include search.control-link;
}
[aria-current='page'] {
  @include search.current;
}
.search-page__scope,
p {
  @include search.muted;
}
a {
  @include search.link;
}
p {
  @include search.wrap;
}
@media (max-width: 480px) {
  :deep(.search-page__viewport) {
    padding: 1rem 0.75rem;
  }
}
</style>
