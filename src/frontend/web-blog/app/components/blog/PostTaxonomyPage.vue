<!-- @file PostTaxonomyPage.vue @description 标签与专栏的共享页面展示，沿用首页文章卡片及主题分页 -->
<template>
  <CommonPageFrame class="main-inner taxonomy-page" :header-key="heading">
    <template #header>
      <CommonPageHeader :title="heading" :subtitle="description" :icon="icon">
        <template #action>
          <NuxtLink to="/" class="taxonomy-page__home">{{ $t('article.tabs.all') }}</NuxtLink>
        </template>
      </CommonPageHeader>
    </template>
    <BlogPostCardList
      :posts="posts"
      :total="total"
      :current-page="page"
      :pending="pending"
      :error-message="errorMessage"
      active-tab="all"
      display-mode="pagination"
      @page="$emit('page', $event)"
      @retry="$emit('retry')"
    />
  </CommonPageFrame>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

defineProps<{
  heading: string
  description: string
  icon: string
  posts: PostItem[]
  total: number
  page: number
  pending: boolean
  errorMessage: string
}>()
defineEmits<{ page: [page: number]; retry: [] }>()
</script>

<style scoped lang="scss">
.taxonomy-page :deep(.page-header__info) {
  min-width: 0;
  overflow-wrap: anywhere;
}
.taxonomy-page :deep(.page-header__icon) {
  flex-shrink: 0;
}
.taxonomy-page__home {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  color: var(--text-main);
  background: var(--surface-1);
}
</style>
