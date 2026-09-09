<!--
  @file MomentList.vue
  @description 朋友圈动态列表，含无限滚动加载
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="moment-list" :aria-busy="pending">
    <CommonRequestFeedback
      v-if="!moments.length && (pending || errorMessage)"
      :pending="pending"
      :compact="moments.length > 0"
      :title="errorMessage || '正在加载动态'"
      :description="moments.length ? '仍显示上次成功加载的动态。' : undefined"
      @retry="$emit('retry')"
    />
    <div v-if="moments.length && (pending || errorMessage)" class="moment-list__feedback">
      <p v-if="pending" role="status">正在加载动态…</p>
      <div v-else role="alert">
        {{ errorMessage }}，已保留原内容。<button type="button" @click="$emit('retry')">重试</button>
      </div>
    </div>
    <MomentCard
      v-for="moment in moments"
      :id="`moment-${moment.id}`"
      :key="moment.id"
      :moment="moment"
      :owner-profile="ownerProfile"
      :state="states[moment.id]"
      :syncing="pending"
      :detail-query="detailQuery"
      @like="$emit('like', $event)"
      @draft="$emit('draft', $event)"
      @comment="$emit('comment', $event)"
      @comments="$emit('comments', $event)"
    />
    <div v-if="hasMore" ref="sentinelRef" class="moment-list__sentinel">
      <button
        type="button"
        class="moment-list__more"
        :disabled="pending || !!errorMessage || !hydrated"
        @click="$emit('more')"
      >
        {{ pending ? '正在加载…' : '加载更多动态' }}
      </button>
    </div>
    <div v-else-if="moments.length && !pending && !errorMessage" class="moment-list__end">
      <span class="moment-list__end-line" /><span class="moment-list__end-text">没有更多了</span
      ><span class="moment-list__end-line" />
    </div>
    <CommonStateBlock
      v-if="!moments.length && !pending && !errorMessage"
      icon="lucide:message-square"
      :title="filtered ? '没有找到相关动态' : '暂无动态'"
      :description="filtered ? '调整或清除筛选后再试。' : '公开发布的动态会显示在这里。'"
    />
  </div>
</template>
<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import type { MomentItem, MomentUserProfile } from '~/features/moment/types'
import type { MomentInteractionState } from '~/features/moment/session'
const props = defineProps<{
  moments: MomentItem[]
  ownerProfile: MomentUserProfile
  states: Record<string, MomentInteractionState>
  pending: boolean
  errorMessage?: string
  hasMore: boolean
  filtered?: boolean
  detailQuery?: Record<string, string>
}>()
const emit = defineEmits<{
  retry: []
  more: []
  comment: [id: string]
  comments: [id: string]
  draft: [value: { id: string; value: string }]
  like: [value: { id: string; liked: boolean; complete: (success: boolean) => void }]
}>()
const sentinelRef = ref<HTMLElement | null>(null),
  hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
useIntersectionObserver(
  sentinelRef,
  (entries) => {
    if (
      entries.some((entry) => entry.isIntersecting) &&
      hydrated.value &&
      props.hasMore &&
      !props.pending &&
      !props.errorMessage
    )
      emit('more')
  },
  { rootMargin: '100px' },
)
</script>

<style lang="scss" scoped>
.moment-list__feedback {
  position: sticky;
  top: 0;
  height: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 3;
  pointer-events: none;
  > * {
    height: fit-content;
    max-width: 100%;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: $radius-md;
    background: var(--surface-1);
    font-size: 0.8125rem;
    pointer-events: auto;
  }
  button {
    min-height: 44px;
    padding: 0 0.5rem;
    color: var(--accent-text);
  }
}
.moment-list__more {
  min-height: 44px;
  padding: 0.5rem 1rem;
  color: var(--accent-text);
}
.moment-list__notice {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.6;
}
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
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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
