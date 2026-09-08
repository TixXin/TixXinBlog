<!--
  @file [id].vue
  @description 编辑文章，共用恢复和版本保护工作区。
-->
<template>
  <section>
    <h1>编辑文章</h1>
    <AdminPostWorkspace :id="String(route.params.id)" :key="String(route.params.id)" />
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '编辑文章', robots: 'noindex, nofollow' })
const route = useRoute()
</script>
