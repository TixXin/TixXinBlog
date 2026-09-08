<!--
  @file new.vue
  @description 新建文章，共用恢复和版本保护工作区。
-->
<template>
  <section>
    <h1>新建文章</h1>
    <AdminPostWorkspace :id="null" />
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '新建文章', robots: 'noindex, nofollow' })
</script>
