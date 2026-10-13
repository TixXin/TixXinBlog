<!-- @file [id].vue @description 按记录编号隔离订阅编辑状态 -->
<template>
  <ClientOnly><SubscriptionEditor :id="Number(route.params.id)" /></ClientOnly>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: (route) => route.path })
useSeoMeta({ title: '编辑订阅', robots: 'noindex, nofollow' })
const route = useRoute()
</script>
