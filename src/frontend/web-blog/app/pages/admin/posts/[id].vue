<!--
  @file [id].vue
  @description 编辑文章，共用恢复和版本保护工作区。
-->
<template>
  <section>
    <h1>{{ $t('admin-content.postList.editTitle') }}</h1>
    <AdminPostWorkspace :id="String(route.params.id)" :key="String(route.params.id)" />
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.postList.editTitle'), robots: 'noindex, nofollow' })
const route = useRoute()
</script>
