<!--
  @file InfoDrawer.vue
  @description 朋友圈紧凑信息入口，只展示固定侧栏未提供的作者资料和日历
-->
<template>
  <CommonContextDrawer v-model:open="open" class="page-context-entry" :label="label" icon="lucide:list-filter">
    <div class="moment-info-drawer">
      <SidebarMomentAuthorCard v-if="showInfo" :stats="stats" :profile="profile" />
      <SidebarMomentCalendarCard
        v-if="showInfo"
        :moment-dates="dates"
        :selected-date="selectedDate"
        @select-date="$emit('selectDate', $event)"
      />
      <slot />
    </div>
  </CommonContextDrawer>
</template>
<script setup lang="ts">
import type { MomentAuthorStats } from '~/components/sidebar/MomentAuthorCard.vue'
import type { OwnerCardInfo } from '~/features/site/types'

withDefaults(
  defineProps<{
    stats: MomentAuthorStats
    profile: OwnerCardInfo
    dates: string[]
    selectedDate: string | null
    showInfo: boolean
    label?: string
  }>(),
  { label: '筛选动态' },
)
const open = defineModel<boolean>('open', { default: false })
defineEmits<{ selectDate: [date: string | null] }>()
</script>
<style lang="scss" scoped>
.moment-info-drawer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
