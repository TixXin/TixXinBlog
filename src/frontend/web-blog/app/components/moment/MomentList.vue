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
      <CommonRequestFeedback
        v-else
        compact
        :title="errorMessage || '动态加载失败，请重试'"
        description="仍显示上次成功加载的动态。"
        @retry="$emit('retry')"
      />
    </div>
    <MomentCard
      v-for="moment in moments"
      :id="`moment-${moment.id}`"
      :key="moment.id"
      tabindex="-1"
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
        :aria-busy="pending"
        type="button"
        class="moment-list__more"
        :disabled="!!errorMessage || !hydrated"
        :aria-disabled="pending"
        @click="requestMore"
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
import type { MomentCommentSubmission, MomentItem, MomentUserProfile } from '~/features/moment/types'
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
  comment: [submission: MomentCommentSubmission]
  comments: [id: string]
  draft: [value: { id: string; value: string }]
  like: [value: { id: string; liked: boolean; complete: (success: boolean) => void }]
}>()
const sentinelRef = ref<HTMLElement | null>(null),
  hydrated = ref(false),
  // 由按钮发起加载时记下当时最后一条动态，新页到达后把焦点交给其后的第一条
  focusAfter = ref<string | null>(null)
onMounted(() => {
  hydrated.value = true
})
// 加载中只标记 aria-disabled，不用 disabled，避免键盘焦点随按钮禁用而丢失
function requestMore() {
  if (props.pending || props.errorMessage || !props.hasMore) return
  focusAfter.value = props.moments.at(-1)?.id ?? null
  emit('more')
}
watch(
  () => [props.pending, props.errorMessage, props.moments] as const,
  async ([pending, errorMessage, moments]) => {
    if (pending || focusAfter.value === null) return
    const index = moments.findIndex((moment) => moment.id === focusAfter.value)
    const next = index >= 0 ? moments[index + 1] : undefined
    // 失败、筛选替换列表或尚未追加新页时不抢焦点；失败保留在按钮上以便重试
    if (errorMessage || index < 0) focusAfter.value = null
    if (!next) return
    focusAfter.value = null
    await nextTick()
    document.getElementById(`moment-${next.id}`)?.focus()
  },
)
useIntersectionObserver(
  sentinelRef,
  (entries) => {
    // 键盘 Tab 聚焦按钮会把它滚入视口；此时交给按钮由用户确认，避免聚焦即翻页、回车再翻一页
    const keyboardFocused = !!sentinelRef.value?.querySelector(':focus-visible')
    if (
      entries.some((entry) => entry.isIntersecting) &&
      !keyboardFocused &&
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
}
.moment-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
