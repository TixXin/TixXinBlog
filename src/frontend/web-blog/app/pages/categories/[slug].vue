<!--
  @file [slug].vue
  @description 专栏文章独立页，路由标识沿用 folder 名称，服务端分页
  @author TixXin
  @since 2026-10-18
-->
<template>
  <BlogPostTaxonomyPage
    :heading="heading"
    :description="description"
    icon="lucide:folder"
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
const { heading, description, page, changePage, listOptions } = await usePostTaxonomyRoute('category')
const { posts, total, pending, error, refresh, pageSize } = await usePostList(listOptions)
function correctPage() {
  if (pending.value || error.value) return
  const lastPage = Math.max(1, Math.ceil(total.value / pageSize))
  if (page.value > lastPage) return changePage(lastPage, true)
}
await correctPage()
watch([total, pending, error], correctPage)
</script>
