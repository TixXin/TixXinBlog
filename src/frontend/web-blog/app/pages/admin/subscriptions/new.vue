<!-- @file new.vue @description 新建平台订阅，复用可恢复的订阅编辑器 -->
<template>
  <ClientOnly><SubscriptionEditor :id="null" /></ClientOnly>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '新建订阅', robots: 'noindex, nofollow' })
</script>
