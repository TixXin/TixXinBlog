<!-- @file Overview.vue @description 留言侧栏与紧凑抽屉共用真实统计展示 -->
<template>
  <div class="guestbook-overview">
    <CommonRequestFeedback
      v-if="pending || error"
      compact
      :pending="pending"
      :title="error ? $t('interaction.guestbookOverview.unavailable') : $t('interaction.guestbookOverview.loading')"
      :description="
        error ? (data ? $t('interaction.guestbookOverview.staleDescription', { error }) : error) : undefined
      "
      @retry="$emit('retry')"
    />
    <GuestbookChatStats :stats="stats" />
    <GuestbookChatRules v-if="data" :rules="data.rules" />
    <GuestbookActiveMembers v-if="data" :members="data.members" />
  </div>
</template>
<script setup lang="ts">
import type { GuestbookMetadata } from '~/features/guestbook/types'
const props = defineProps<{ data: GuestbookMetadata | null; pending: boolean; error?: string }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n()
const count = (value: number | undefined) => (value === undefined ? '—' : formatNumber(value))
const stats = computed(() => [
  { label: t('interaction.guestbookOverview.statMessages'), value: count(props.data?.stats.messages) },
  { label: t('interaction.guestbookOverview.statMembers'), value: count(props.data?.stats.members) },
  { label: t('interaction.guestbookOverview.statRecent'), value: count(props.data?.stats.recent) },
  { label: t('interaction.guestbookOverview.statToday'), value: count(props.data?.stats.today) },
])
</script>
<style scoped lang="scss">
.guestbook-overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
