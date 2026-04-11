<!--
  @file FlashNoteCard.vue
  @description 单条闪念笔记卡片：内容 + 标签 + 时间 + 删除
  @author TixXin
  @since 2026-04-11
-->

<template>
  <article class="flash-note-card" :class="{ 'flash-note-card--cited': cited }">
    <div class="flash-note-card__content">{{ note.content }}</div>

    <div v-if="note.tags.length > 0" class="flash-note-card__tags">
      <span v-for="t in note.tags" :key="t" class="flash-note-card__tag">#{{ t }}</span>
    </div>

    <footer class="flash-note-card__footer">
      <time class="flash-note-card__time" :datetime="note.createdAt">{{ relativeTime }}</time>
      <button
        v-if="!readOnly"
        type="button"
        class="flash-note-card__action"
        aria-label="删除闪念"
        @click="$emit('remove', note.id)"
      >
        <Icon name="lucide:trash-2" size="13" />
      </button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

const props = defineProps<{
  note: FlashNote
  cited?: boolean
  readOnly?: boolean
}>()

defineEmits<{
  remove: [id: string]
}>()

const relativeTime = computed(() => {
  const created = new Date(props.note.createdAt).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - created)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(props.note.createdAt).toLocaleDateString('zh-CN')
})
</script>

<style lang="scss" scoped>
.flash-note-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  padding: 0.875rem 1rem 0.625rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition:
    border-color 0.2s,
    transform 0.2s;

  &:hover {
    border-color: var(--border);
  }

  &--cited {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }
}

.flash-note-card__content {
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}

.flash-note-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.flash-note-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: $radius-full;
}

.flash-note-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--text-faint);
}

.flash-note-card__time {
  font-variant-numeric: tabular-nums;
}

.flash-note-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  border-radius: $radius-sm;
  transition:
    color 0.2s,
    background 0.2s;

  &:hover {
    color: var(--danger);
    background: var(--surface-2);
  }
}
</style>
