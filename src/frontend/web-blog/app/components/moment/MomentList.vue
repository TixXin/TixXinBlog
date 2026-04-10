<!--
  @file MomentList.vue
  @description 朋友圈动态列表，含无限滚动加载
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-list">
    <MomentCard v-for="moment in displayedMoments" :key="moment.id" :moment="moment" />

    <!-- 加载哨兵 -->
    <div v-if="hasMore" ref="sentinelRef" class="moment-list__sentinel">
      <div v-if="showSpinner" class="moment-list__spinner">
        <Icon name="lucide:loader-2" size="20" class="moment-list__spinner-icon" />
        <span>加载中...</span>
      </div>
    </div>

    <!-- 已加载全部 -->
    <div v-else-if="displayedMoments.length > 0" class="moment-list__end">
      <span class="moment-list__end-line" />
      <span class="moment-list__end-text">没有更多了</span>
      <span class="moment-list__end-line" />
    </div>

    <!-- 空态 -->
    <div v-if="displayedMoments.length === 0" class="moment-list__empty">
      <CommonStateBlock icon="lucide:message-square" title="暂无动态" description="没有找到匹配的动态内容" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MomentItem } from '~/features/moment/types'
import { useMomentPagination } from '~/composables/useMomentPagination'

const props = defineProps<{
  moments: MomentItem[]
  selectedTopic?: string | null
}>()

const allMoments = computed(() => props.moments)
const selectedTopic = computed(() => props.selectedTopic ?? null)

const { displayedMoments, hasMore, showSpinner, sentinelRef } = useMomentPagination({
  allMoments,
  selectedTopic,
})
</script>

<style lang="scss" scoped>
.moment-list {
  display: flex;
  flex-direction: column;
}

.moment-list__sentinel {
  min-height: 1px;
  padding: 1rem 0;
}

.moment-list__spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-faint);
  font-size: 0.8125rem;
}

.moment-list__spinner-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.moment-list__end {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0 1rem;
}

.moment-list__end-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.moment-list__end-text {
  font-size: 0.75rem;
  color: var(--text-faint);
  white-space: nowrap;
}

.moment-list__empty {
  padding: 3rem 0;
}
</style>
