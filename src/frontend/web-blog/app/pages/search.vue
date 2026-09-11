<!-- @file search.vue @description 可分享和返回的六域公开搜索；分组预览与单类型服务端分页。 -->
<template>
  <CommonPageFrame class="main-inner" header-key="search">
    <template #header>
      <CommonPageHeader title="站内搜索" subtitle="按内容类型查找文章、作品与日常记录" icon="lucide:search" />
    </template>
    <template #default>
      <CommonCustomScrollbar class="search-page" viewport-class="search-page__viewport" primary>
        <form class="search-page__form" @submit.prevent="submit">
          <input
            v-model="keyword"
            type="search"
            aria-label="搜索站内公开内容"
            placeholder="输入关键词"
            maxlength="200"
          />
          <button type="submit">搜索</button>
        </form>
        <nav class="search-page__types" aria-label="搜索内容类型">
          <NuxtLink
            v-for="(label, scope) in searchTypeLabels"
            :key="scope"
            :to="searchLocation(activeQuery, scope)"
            :aria-current="activeType === scope ? 'page' : undefined"
            >{{ label }}</NuxtLink
          >
        </nav>
        <p class="search-page__scope">文章检索标题、摘要、正文与标签；其他类型检索各自公开的介绍、正文或分类字段。</p>
        <p v-if="!activeQuery.trim()">输入关键词开始搜索。</p>
        <template v-else>
          <CommonRequestFeedback
            v-if="!mounted || isSearching || error"
            :pending="!mounted || isSearching"
            :compact="groups.length > 0"
            :title="error || '正在搜索公开内容'"
            @retry="refresh"
          />
          <template v-if="mounted && !isSearching">
            <p v-if="activeType === 'all'">各类型分别预览前 3 项；选择类型查看该类型的全部结果。</p>
            <section
              v-for="group in groups"
              :key="group.type"
              class="search-page__group"
              :data-search-type="group.type"
            >
              <header>
                <h2>{{ searchTypeLabels[group.type] }}</h2>
                <span v-if="group.total !== null">{{ group.total }} 项</span>
                <NuxtLink
                  v-if="activeType === 'all' && group.total !== null && group.total > group.items.length"
                  :to="searchLocation(activeQuery, group.type)"
                  >查看全部{{ searchTypeLabels[group.type] }}</NuxtLink
                >
              </header>
              <p v-if="group.unavailable" role="status">此来源暂不可用，其他类型仍可浏览。</p>
              <p v-else-if="!group.items.length">当前条件下没有结果。</p>
              <ul v-else>
                <li v-for="item in group.items" :key="item.id">
                  <a v-if="item.type === 'link'" :href="item.url" target="_blank" rel="noopener noreferrer">
                    <Icon :name="item.icon" />{{ item.title }}<Icon name="lucide:external-link" />
                  </a>
                  <NuxtLink v-else :to="item.url"><Icon :name="item.icon" />{{ item.title }}</NuxtLink>
                  <p>{{ item.description }}</p>
                </li>
              </ul>
            </section>
          </template>
          <nav
            v-if="
              !isSearching && activeType !== 'all' && total !== null && (total > SEARCH_PAGE_SIZE || activePage > 1)
            "
            class="search-page__pagination"
            aria-label="搜索结果分页"
          >
            <NuxtLink v-if="activePage > 1" :to="searchLocation(activeQuery, activeType, activePage - 1)"
              >上一页</NuxtLink
            >
            <span role="status">第 {{ activePage }} 页 · 共 {{ total }} 项</span>
            <NuxtLink
              v-if="activePage * SEARCH_PAGE_SIZE < total"
              :to="searchLocation(activeQuery, activeType, activePage + 1)"
              >下一页</NuxtLink
            >
          </nav>
        </template>
      </CommonCustomScrollbar>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { searchLocation, searchScope, searchPage } from '~/features/search/query'
import { searchTypeLabels, SEARCH_PAGE_SIZE } from '~/features/search/types'
const route = useRoute(),
  router = useRouter()
const activeQuery = computed(() => (typeof route.query.q === 'string' ? route.query.q.slice(0, 200) : ''))
const activeType = computed(() => searchScope(route.query.type))
const activePage = computed(() => (activeType.value === 'all' ? 1 : searchPage(route.query.page)))
const keyword = ref(activeQuery.value),
  mounted = ref(false)
const { groups, total, isSearching, error, search, cancel } = useSearch()
useSeoMeta({
  title: '站内搜索',
  robots: 'noindex, follow',
  description: '按类型检索本站公开文章、项目、友链、图库、闪念与朋友圈。',
})
function submit() {
  const location = searchLocation(keyword.value, activeType.value)
  if (router.resolve(location).fullPath === route.fullPath) void refresh()
  else void router.push(location)
}
async function refresh() {
  const path = route.fullPath
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
  color: var(--accent);
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
a {
  color: var(--accent);
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
