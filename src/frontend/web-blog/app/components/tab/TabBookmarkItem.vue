<!--
  @file TabBookmarkItem.vue
  @description 标签页书签格子：图标 + 名称，支持 lucide 图标或单字母 fallback
  @author TixXin
  @since 2026-04-11
-->

<template>
  <a :href="bookmark.url" :title="bookmark.url" target="_blank" rel="noopener" class="tab-bm">
    <span class="tab-bm__icon" :style="iconComputedStyle">
      <Icon v-if="isLucide" :name="bookmark.icon!" :size="Math.round(tabSettings.iconSize * 0.46)" />
      <span v-else class="tab-bm__letter">{{ letter }}</span>
    </span>
    <span v-if="tabSettings.showIconName" class="tab-bm__name" :style="nameComputedStyle">{{ bookmark.name }}</span>
    <button
      v-if="!readOnly"
      type="button"
      class="tab-bm__remove"
      :aria-label="`删除 ${bookmark.name}`"
      @click.prevent.stop="emit('remove', bookmark.id)"
    >
      <Icon name="lucide:x" size="11" />
    </button>
  </a>
</template>

<script setup lang="ts">
import type { Bookmark } from '~/features/tab/types'

const props = defineProps<{ bookmark: Bookmark; readOnly?: boolean }>()
const emit = defineEmits<{ remove: [id: string] }>()

const { settings: tabSettings } = useTabSettings()

const isLucide = computed(() => Boolean(props.bookmark.icon?.startsWith('lucide:')))
const letter = computed(() => props.bookmark.icon || props.bookmark.name.charAt(0).toUpperCase())

const effectiveRadius = computed(() => {
  const s = tabSettings.value
  if (s.iconStyle === 'rounded') return Math.floor(s.iconSize / 2)
  if (s.iconStyle === 'flat') return Math.min(4, s.iconRadius)
  return s.iconRadius
})

const iconComputedStyle = computed(() => ({
  background: props.bookmark.color || 'var(--accent)',
  color: '#fff',
  width: `${tabSettings.value.iconSize}px`,
  height: `${tabSettings.value.iconSize}px`,
  borderRadius: `${effectiveRadius.value}px`,
  opacity: String(tabSettings.value.iconOpacity),
  boxShadow: tabSettings.value.iconStyle === 'flat' ? 'none' : undefined,
}))

const nameComputedStyle = computed(() => ({
  fontSize: `${tabSettings.value.nameSize}px`,
  color: tabSettings.value.nameColor || undefined,
}))
</script>

<style lang="scss" scoped>
.tab-bm {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 0.5rem;
  border-radius: $radius-card;
  text-decoration: none;
  color: var(--text-main);
  transition: all 0.2s;

  &:hover {
    background: var(--surface-1);
    transform: translateY(-2px);

    .tab-bm__remove {
      opacity: 1;
    }
  }
}

.tab-bm__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
  transition:
    width 0.2s ease,
    height 0.2s ease,
    border-radius 0.2s ease,
    opacity 0.2s ease;
}

.tab-bm__letter {
  font-size: 1.125rem;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
}

.tab-bm__name {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bm__remove {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-soft);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}
</style>
