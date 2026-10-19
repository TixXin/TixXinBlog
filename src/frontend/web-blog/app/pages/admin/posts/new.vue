<!--
  @file new.vue
  @description 新建文章，共用恢复和版本保护工作区。
-->
<template>
  <section>
    <h1>{{ $t('admin-content.postList.newTitle') }}</h1>
    <AdminPostWorkspace :id="null" />
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.postList.newTitle'), robots: 'noindex, nofollow' })
</script>
