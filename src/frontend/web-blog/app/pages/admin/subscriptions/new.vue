<!-- @file new.vue @description 新建平台订阅，复用可恢复的订阅编辑器 -->
<template>
  <ClientOnly><SubscriptionEditor :id="null" /></ClientOnly>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.subscriptionList.createTitle'), robots: 'noindex, nofollow' })
</script>
