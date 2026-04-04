<!--
  @file MomentList.vue
  @description 朋友圈动态列表
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-list">
    <MomentCard v-for="moment in moments" :key="moment.id" :moment="moment" />

    <div v-if="moments.length === 0" class="moment-list__empty">
      <CommonStateBlock icon="lucide:message-square" title="暂无动态" description="博主最近很安静，什么也没发" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MomentItem } from '~/features/moment/types'

defineProps<{
  moments: MomentItem[]
}>()
</script>

<style lang="scss" scoped>
.moment-list {
  display: flex;
  flex-direction: column;
}

.moment-list__empty {
  padding: 3rem 0;
}
</style>
