<!--
  @file FlashNoteCardFooter.vue
  @description 闪念笔记卡片底部操作栏：相对时间、类型标识、点赞、评论开关、复制与内联删除确认
  @author TixXin
  @since 2026-10-21
-->

<template>
  <footer class="fnc__footer">
    <!-- type 标识：仅非 memo（默认态）显示，避免视觉冗余 -->
    <span v-if="typeMeta" class="fnc__type" :class="`fnc__type--${note.type}`">
      <Icon :name="typeMeta.icon" size="11" />
      {{ typeMeta.label }}
    </span>
    <NuxtLink
      v-if="!note.isDraft && !note.isArchived"
      :to="`/flash/${note.id}`"
      class="fnc__time"
      :aria-label="$t('flash-moment.noteCard.viewDetail', { time: relativeTime })"
    >
      <Icon name="lucide:clock-3" size="11" />
      {{ relativeTime }}
    </NuxtLink>
    <span v-else class="fnc__time"
      >{{ relativeTime }} <span aria-hidden="true">·</span> {{ $t('flash-moment.noteCard.unpublished') }}</span
    >
    <div class="fnc__actions">
      <button
        v-if="!staticSite"
        type="button"
        class="fnc__action"
        :class="{ 'fnc__action--active': liked }"
        :aria-label="liked ? $t('flash-moment.noteCard.unlike') : $t('flash-moment.noteCard.like')"
        :aria-pressed="liked"
        :disabled="busy || interactive === false || note.isDraft || note.isArchived"
        @click="$emit('toggle-like', note.id)"
      >
        <Icon :name="liked ? 'lucide:heart' : 'lucide:heart'" size="14" :class="liked ? 'fnc__heart-filled' : ''" />
        <span v-if="note.likes > 0" class="fnc__action-count">{{ note.likes }}</span>
      </button>
      <button
        v-if="!staticSite"
        type="button"
        class="fnc__action"
        :class="{ 'fnc__action--active': commentOpen }"
        :aria-label="$t('flash-moment.noteCard.comment')"
        :aria-expanded="commentOpen"
        :disabled="busy || interactive === false || note.isDraft || note.isArchived"
        @click="$emit('update:commentOpen', !commentOpen)"
      >
        <Icon name="lucide:message-circle" size="14" />
        <span v-if="commentCount > 0" class="fnc__action-count">{{ commentCount }}</span>
      </button>
      <button type="button" class="fnc__action" :aria-label="$t('flash-moment.noteCard.copy')" @click="onCopy">
        <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="14" />
      </button>
      <!-- 置顶 / 取消置顶（仅非只读） -->
      <button
        v-if="!readOnly"
        type="button"
        class="fnc__action"
        :aria-label="$t('flash-moment.noteCard.edit')"
        :disabled="busy"
        @click="$emit('edit')"
      >
        <Icon name="lucide:pencil" size="14" />
      </button>
      <button
        v-if="!readOnly"
        :disabled="busy"
        type="button"
        class="fnc__action"
        :class="{ 'fnc__action--active': note.isPinned }"
        :aria-label="note.isPinned ? $t('flash-moment.noteCard.unpin') : $t('flash-moment.noteCard.pin')"
        @click="$emit('set-pinned', { id: note.id, pinned: !note.isPinned })"
      >
        <Icon :name="note.isPinned ? 'lucide:pin-off' : 'lucide:pin'" size="14" />
      </button>
      <!-- 归档 / 恢复（仅非只读） -->
      <button
        v-if="!readOnly"
        :disabled="busy"
        type="button"
        class="fnc__action"
        :aria-label="note.isArchived ? $t('flash-moment.noteCard.restore') : $t('flash-moment.noteCard.archive')"
        @click="$emit('set-archived', { id: note.id, archived: !note.isArchived })"
      >
        <Icon :name="note.isArchived ? 'lucide:archive-restore' : 'lucide:archive'" size="14" />
      </button>
      <!-- 删除：内联确认态，3s 超时自动恢复 -->
      <div v-if="confirmingDelete" class="fnc__confirm-delete">
        <span class="fnc__confirm-delete-text">{{ $t('flash-moment.noteCard.confirmDelete') }}</span>
        <button
          type="button"
          class="fnc__confirm-yes"
          :aria-label="$t('flash-moment.noteCard.confirmDeleteAria')"
          :disabled="busy"
          @click="confirmDelete"
        >
          <Icon name="lucide:check" size="12" />
        </button>
        <button
          type="button"
          class="fnc__confirm-no"
          :aria-label="$t('flash-moment.noteCard.cancelDelete')"
          @click="cancelDelete"
        >
          <Icon name="lucide:x" size="12" />
        </button>
      </div>
      <button
        v-else-if="!readOnly"
        type="button"
        class="fnc__action fnc__action--danger"
        :aria-label="$t('flash-moment.noteCard.delete')"
        @click="startDelete"
      >
        <Icon name="lucide:trash-2" size="14" />
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'
// 静态发布没有访客互动，点赞与评论按钮不渲染
const staticSite = useStaticSite()

const props = defineProps<{
  note: FlashNote
  liked: boolean
  commentOpen: boolean
  commentCount: number
  relativeTime: string
  typeMeta?: { icon: string; label: string }
  readOnly?: boolean
  busy?: boolean
  interactive?: boolean
}>()

const emit = defineEmits<{
  'toggle-like': [id: string]
  'update:commentOpen': [open: boolean]
  edit: []
  'set-pinned': [payload: { id: string; pinned: boolean }]
  'set-archived': [payload: { id: string; archived: boolean }]
  remove: [id: string]
}>()

const { success, error: toastError } = useToast()
const { t } = useI18n()

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const confirmingDelete = ref(false)
let deleteTimer: ReturnType<typeof setTimeout> | null = null

async function onCopy() {
  try {
    await navigator.clipboard.writeText(props.note.content)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 1500)
    success(t('flash-moment.noteCard.copied'))
  } catch {
    toastError(t('flash-moment.noteCard.copyFailed'))
  }
}

function startDelete() {
  confirmingDelete.value = true
  deleteTimer = setTimeout(() => {
    confirmingDelete.value = false
  }, 3000)
}

function confirmDelete() {
  if (deleteTimer) clearTimeout(deleteTimer)
  confirmingDelete.value = false
  emit('remove', props.note.id)
}

function cancelDelete() {
  if (deleteTimer) clearTimeout(deleteTimer)
  confirmingDelete.value = false
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
  if (deleteTimer) clearTimeout(deleteTimer)
})
</script>

<style lang="scss" scoped>
.fnc__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-soft);
}

.fnc__time {
  position: relative;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  transition: color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: -4px -2px;
  }

  &:hover {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }
}

.fnc__type {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-right: 0.5rem;
  padding: 0.0625rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: $radius-sm;
  line-height: 1.4;
}

.fnc__type--idea {
  color: var(--tag-amber-text);
  background: var(--tag-amber-bg);
}

.fnc__type--todo {
  color: var(--tag-blue-text);
  background: var(--tag-blue-bg);
}

.fnc__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
  max-width: 100%;
  align-items: center;
  gap: 0.125rem;
}

.fnc__action {
  min-width: 32px;
  min-height: 32px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  opacity: 1;
  transition:
    opacity 0.2s,
    color 0.2s,
    background 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  &--active {
    color: var(--accent-text);
    opacity: 1;
  }

  &--danger:hover:not(:disabled) {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }

  &:disabled {
    opacity: 0.45;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

@media (pointer: coarse) {
  .fnc__action {
    min-width: 44px;
    min-height: 44px;
  }
}

.fnc__heart-filled {
  fill: currentColor;
}

.fnc__action-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.fnc__confirm-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  animation: fnc-confirm-in 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.fnc__confirm-delete-text {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--danger);
}

.fnc__confirm-yes,
.fnc__confirm-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  border-radius: $radius-full;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s,
    color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.fnc__confirm-yes {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);

  &:hover {
    background: var(--danger);
    color: #fff;
  }
}

.fnc__confirm-no {
  background: var(--surface-2);
  color: var(--text-soft);

  &:hover {
    background: var(--surface-3, var(--surface-2));
    color: var(--text-main);
  }
}

@keyframes fnc-confirm-in {
  from {
    opacity: 0;
    transform: translateX(4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
