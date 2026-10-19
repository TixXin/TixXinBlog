<!--
  @file media.vue
  @description 媒体资源管理页，查询变化复用实例以保留上传队列。
-->
<template>
  <section class="admin-media">
    <h1>{{ $t('admin-media.mediaPage.title') }}</h1>
    <p>{{ $t('admin-media.mediaPage.intro') }}</p>
    <ClientOnly><AdminMediaWorkspace /></ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: '/admin/media' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.mediaPage.title'), robots: 'noindex, nofollow' })
</script>
<style scoped>
.admin-media {
  min-width: 0;
  max-width: 100%;
}
h1 {
  font-size: 1.6rem;
  font-weight: 700;
}
p {
  color: var(--text-muted);
  margin: 0.7rem 0;
}
</style>
