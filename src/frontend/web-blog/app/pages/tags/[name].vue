<!--
  @file [name].vue
  @description 标签文章独立页，服务端按标签 slug 读取分页文章
  @author TixXin
  @since 2026-10-18
-->
<template>
  <BlogPostTaxonomyPage
    :heading="heading"
    :description="description"
    icon="lucide:hash"
    :posts="posts"
    :total="total"
    :page="page"
    :pending="pending"
    :error-message="error ? '文章加载失败，请重试' : ''"
    @page="changePage($event)"
    @retry="refresh()"
  />
</template>

<script setup lang="ts">
import { isCanonicalPageParam } from '~/features/post/listQuery'

// 名称变更时重新建立目录与请求所有权，翻页保留当前页面实例。本页不往右栏传送内容。
definePageMeta({ key: (route) => route.path, rightSidebar: false })
const route = useRoute()
const { heading, description, page, changePage, listOptions } = await usePostTaxonomyRoute('tag')
const { posts, total, pending, error, refresh, pageSize } = await usePostList(listOptions)
function correctPage() {
  if (pending.value || error.value) return
  const lastPage = Math.max(1, Math.ceil(total.value / pageSize))
  if (page.value > lastPage) return changePage(lastPage, true)
  // 0、abc、01 等非规范页码已按解析结果显示，地址栏同步改写为规范地址，页码不变不会重新请求
  if (!isCanonicalPageParam(route.query.page, page.value)) return changePage(page.value, true)
}
// 越界与非规范页码纠正只在挂载后执行：服务端渲染或水合期间改写 URL 不会刷新本页的路由与列表，会留下“地址回到末页、内容仍是空页”的状态
onMounted(correctPage)
watch([total, pending, error], correctPage)
</script>
