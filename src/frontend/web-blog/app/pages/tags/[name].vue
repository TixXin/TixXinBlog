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
// 名称变更时重新建立目录与请求所有权，翻页保留当前页面实例。本页不往右栏传送内容。
definePageMeta({ key: (route) => route.path, rightSidebar: false })
const { heading, description, page, changePage, listOptions } = await usePostTaxonomyRoute('tag')
const { posts, total, pending, error, refresh, pageSize } = await usePostList(listOptions)
function correctPage() {
  if (pending.value || error.value) return
  const lastPage = Math.max(1, Math.ceil(total.value / pageSize))
  if (page.value > lastPage) return changePage(lastPage, true)
}
await correctPage()
watch([total, pending, error], correctPage)
</script>
