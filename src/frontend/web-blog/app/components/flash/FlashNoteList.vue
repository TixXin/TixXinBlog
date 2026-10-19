<!--
  @file FlashNoteList.vue
  @description 闪念笔记流：双列瀑布流布局，支持空状态、加载态与“加载更多”（按钮 + 接近底部自动加载）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="flash-note-list" :aria-busy="loading || morePending">
    <CommonRequestFeedback
      v-if="loading || errorMessage"
      :pending="loading"
      :compact="notes.length > 0"
      :title="errorMessage || $t('flash-moment.noteList.loading')"
      :description="notes.length ? $t('flash-moment.noteList.staleDesc') : undefined"
      @retry="$emit('retry')"
    />

    <div v-if="!loading && !errorMessage && notes.length === 0" class="flash-note-list__empty">
      <Icon name="lucide:zap-off" size="24" />
      <span>{{
        emptyMessage || (readOnly ? $t('flash-moment.noteList.emptyGuest') : $t('flash-moment.noteList.emptyOwner'))
      }}</span>
    </div>

    <div v-if="notes.length" class="flash-note-list__masonry">
      <FlashNoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :cited="citedIds?.includes(note.id)"
        :highlighted="note.id === highlightedId"
        :read-only="readOnly"
        :busy="pendingIds?.includes(note.id)"
        :current-user-id="currentUserId"
        :guest-id="guestId"
        @remove="$emit('remove', $event)"
        @edit="$emit('edit', note)"
        @toggle-like="$emit('toggle-like', $event)"
        @set-pinned="$emit('set-pinned', $event)"
        @set-archived="$emit('set-archived', $event)"
        @add-comment="$emit('add-comment', $event)"
        @remove-comment="$emit('remove-comment', $event)"
        @tag-click="$emit('tag-click', $event)"
      />
    </div>

    <div v-if="notes.length && hasMore" ref="sentinelRef" class="flash-note-list__more">
      <CommonRequestFeedback
        v-if="showMoreFeedback"
        compact
        :pending="morePending"
        :title="$t('flash-moment.noteList.moreFailed')"
        :description="moreError || $t('flash-moment.noteList.moreFailedDesc')"
        @retry="retryMore"
      />
      <button
        v-else
        type="button"
        class="flash-note-list__more-button"
        :aria-busy="morePending"
        :disabled="!hydrated"
        :aria-disabled="morePending"
        @click="requestMore"
      >
        <Icon name="lucide:chevrons-down" size="14" aria-hidden="true" />
        {{ morePending ? $t('flash-moment.noteList.morePending') : $t('flash-moment.noteList.more') }}
      </button>
    </div>
    <div v-else-if="notes.length && !loading && !errorMessage" ref="endRef" class="flash-note-list__end" tabindex="-1">
      <span class="flash-note-list__end-line" aria-hidden="true" />
      <span class="flash-note-list__end-text">{{ $t('flash-moment.noteList.end') }}</span>
      <span class="flash-note-list__end-line" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import type { FlashNote, FlashCommentSubmission } from '~/features/flash/types'

const props = defineProps<{
  notes: FlashNote[]
  loading?: boolean
  errorMessage?: string | null
  emptyMessage?: string
  pendingIds?: string[]
  citedIds?: string[]
  readOnly?: boolean
  currentUserId?: string | null
  /** 游客设备 id，透传给卡片用于评论删除权限 */
  guestId?: string | null
  /** AI 引用高亮的笔记 id */
  highlightedId?: string | null
  /** 是否还有未展示的闪念（服务端下一页或概览中的下一批） */
  hasMore?: boolean
  morePending?: boolean
  moreError?: string | null
}>()

const emit = defineEmits<{
  retry: []
  more: []
  remove: [id: string]
  edit: [note: FlashNote]
  'toggle-like': [id: string]
  'set-pinned': [payload: { id: string; pinned: boolean }]
  'set-archived': [payload: { id: string; archived: boolean }]
  'add-comment': [payload: FlashCommentSubmission]
  'remove-comment': [payload: { noteId: string; commentId: string }]
  'tag-click': [tag: string]
}>()

// 水合前按钮保持禁用，SSR 与首次客户端渲染一致；挂载后才允许点击和自动加载
const sentinelRef = ref<HTMLElement | null>(null)
const endRef = ref<HTMLElement | null>(null)
const hydrated = ref(false)
const retryingMore = ref(false)
const showMoreFeedback = computed(() => !!props.moreError || retryingMore.value)
// 加载中只用 aria-disabled：真正禁用会让 Chrome 把焦点丢回页面
function requestMore() {
  if (!props.morePending) emit('more')
}
function retryMore() {
  if (props.morePending) return
  retryingMore.value = true
  requestMore()
}
watch(
  () => props.morePending,
  (pending, previous) => {
    if (!pending && previous) retryingMore.value = false
  },
  { flush: 'sync' },
)
// 失败和恢复时把焦点交给对应按钮；读完最后一页时交给结束提示，不掉回页面顶部。
watch(
  [() => props.hasMore, showMoreFeedback],
  async () => {
    if (!sentinelRef.value?.contains(document.activeElement)) return
    await nextTick()
    const target = sentinelRef.value?.querySelector<HTMLButtonElement>('button') ?? endRef.value
    target?.focus({ preventScroll: true })
  },
  { flush: 'pre' },
)
onMounted(() => {
  hydrated.value = true
})
// 接近列表底部时自动加载；失败后不自动重试，等待用户点击，避免请求风暴
useIntersectionObserver(
  sentinelRef,
  (entries) => {
    if (
      entries.some((entry) => entry.isIntersecting) &&
      hydrated.value &&
      props.hasMore &&
      !props.morePending &&
      !props.moreError &&
      !props.loading
    )
      emit('more')
  },
  { rootMargin: '200px' },
)
</script>

<style lang="scss" scoped>
.flash-note-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* CSS columns 实现的双列瀑布流：高度自适应、卡片不被截断 */
.flash-note-list__masonry {
  column-count: 1;
  column-gap: 0.875rem;

  @media (min-width: $breakpoint-md) {
    column-count: 2;
  }

  /* 块级 flex 才能让列平衡生效；inline-flex 会把少量结果全部挤进第一列 */
  > * {
    display: flex;
    width: 100%;
    margin-bottom: 0.875rem;
    /* 关键：避免卡片在两列之间被截断 */
    break-inside: avoid;
  }
}

.flash-note-list__more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0 1rem;
}

.flash-note-list__more-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-1);
  color: var(--accent-text);
  font-size: 0.8125rem;
  cursor: pointer;

  &:disabled,
  &[aria-disabled='true'] {
    cursor: default;
    opacity: 0.7;
  }
}

.flash-note-list__end {
  display: flex;
  outline: none;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0 1rem;
}

.flash-note-list__end-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.flash-note-list__end-text {
  font-size: 0.75rem;
  color: var(--text-faint);
  white-space: nowrap;
}

.flash-note-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 3rem 1rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}
</style>
