<!--
  @file MomentReactions.vue
  @description 朋友圈动态的表情回应：已有回应显示图标与数量并可切换，“添加回应”展开全部可选表情
  @author TixXin
  @since 2026-11-06
-->

<template>
  <div class="moment-reactions" role="group" :aria-label="$t('flash-moment.reactions.group')">
    <button
      v-for="item in reactions"
      :key="item.emoji"
      type="button"
      class="moment-reactions__chip"
      :class="{ 'is-active': item.reacted }"
      :aria-pressed="item.reacted"
      :aria-label="$t('flash-moment.reactions.chip', { name: label(item.emoji), count: item.count })"
      :aria-disabled="pending"
      @click="toggle(item.emoji, !item.reacted)"
    >
      <Icon :name="reactionMeta(item.emoji).icon" size="13" />
      <span>{{ item.count }}</span>
    </button>
    <button
      type="button"
      class="moment-reactions__add"
      :aria-expanded="open"
      :aria-label="$t('flash-moment.reactions.add')"
      @click="open = !open"
    >
      <Icon name="lucide:smile-plus" size="14" />
    </button>
    <div v-if="open" class="moment-reactions__menu">
      <button
        v-for="emoji in options"
        :key="emoji"
        type="button"
        class="moment-reactions__option"
        :aria-pressed="isReacted(emoji)"
        :aria-label="label(emoji)"
        :title="label(emoji)"
        @click="pick(emoji)"
      >
        <Icon :name="reactionMeta(emoji).icon" size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactionMeta } from '~/features/guestbook/reactions'
import type { MomentReaction } from '~/features/moment/types'

/** 与后端 MOMENT_REACTIONS 一致的顺序 */
const options = ['❤️', '🎉', '🔥', '😄', '🙏', '💡'] as const
const props = defineProps<{ reactions: MomentReaction[]; pending?: boolean }>()
const emit = defineEmits<{ react: [value: { emoji: string; reacted: boolean }] }>()
const { t } = useI18n()
const open = ref(false)
const label = (emoji: string) => t(reactionMeta(emoji).labelKey)
const isReacted = (emoji: string) => props.reactions.some((item) => item.emoji === emoji && item.reacted)
function toggle(emoji: string, reacted: boolean) {
  if (!props.pending) emit('react', { emoji, reacted })
}
function pick(emoji: string) {
  open.value = false
  toggle(emoji, !isReacted(emoji))
}
</script>

<style lang="scss" scoped>
.moment-reactions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.moment-reactions__chip,
.moment-reactions__add,
.moment-reactions__option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.75rem;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.75rem;
  cursor: var(--interaction-cursor, pointer);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}

.moment-reactions__chip.is-active {
  border-color: var(--accent);
  color: var(--accent);
}

.moment-reactions__menu {
  display: flex;
  gap: 0.25rem;
}

.moment-reactions__option[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
