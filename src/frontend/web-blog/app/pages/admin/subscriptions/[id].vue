<!-- @file [id].vue @description 按记录编号隔离订阅编辑状态 -->
<template>
  <ClientOnly><SubscriptionEditor :id="Number(route.params.id)" /></ClientOnly>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: (route) => route.path })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.subscriptionList.editTitle'), robots: 'noindex, nofollow' })
const route = useRoute()
</script>
