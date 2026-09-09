<!-- @file Overview.vue @description 留言侧栏与紧凑抽屉共用真实统计展示 -->
<template>
  <div class="guestbook-overview">
    <CommonRequestFeedback
      v-if="pending || error"
      compact
      :pending="pending"
      :title="error || '正在读取留言统计'"
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
const stats = computed(() => [
  { label: '公开留言', value: props.data?.stats.messages.toLocaleString('zh-CN') ?? '—' },
  { label: '参与者', value: props.data?.stats.members.toLocaleString('zh-CN') ?? '—' },
  { label: '近30日', value: props.data?.stats.recent.toLocaleString('zh-CN') ?? '—' },
  { label: '今日 · UTC', value: props.data?.stats.today.toLocaleString('zh-CN') ?? '—' },
])
</script>
<style scoped lang="scss">
.guestbook-overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
