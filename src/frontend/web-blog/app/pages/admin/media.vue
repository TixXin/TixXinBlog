<!--
  @file media.vue
  @description 媒体资源管理页，查询变化复用实例以保留上传队列。
-->
<template>
  <section>
    <h1>媒体资源</h1>
    <p>上传图片、维护替代文本，查看引用或恢复已移除资源。</p>
    <ClientOnly><AdminMediaWorkspace /></ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: '/admin/media' })
useSeoMeta({ title: '媒体资源', robots: 'noindex, nofollow' })
</script>
<style scoped>
h1 {
  font-size: 1.6rem;
  font-weight: 700;
}
p {
  color: var(--text-muted);
  margin: 0.7rem 0;
}
</style>
