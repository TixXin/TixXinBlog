<!--
  @file TabBookmarkGrid.vue
  @description 标签页书签网格容器：包含 + 按钮以触发新建
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tab-grid" :style="gridRootStyle">
    <TransitionGroup name="grid-flip" tag="div" class="tab-grid__list" :style="{ gap: `${tabSettings.iconGap}px` }">
      <TabBookmarkItem
        v-for="bm in bookmarks"
        :key="bm.id"
        :bookmark="bm"
        :read-only="readOnly"
        @remove="emit('remove', $event)"
      />
      <button v-if="!readOnly" key="__add" type="button" class="tab-grid__add" @click="emit('add')">
        <span class="tab-grid__add-icon">
          <Icon name="lucide:plus" size="22" />
        </span>
        <span class="tab-grid__add-name">添加</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { Bookmark } from '~/features/tab/types'

defineProps<{ bookmarks: Bookmark[]; readOnly?: boolean }>()
const emit = defineEmits<{ add: []; remove: [id: string] }>()
const { settings: tabSettings } = useTabSettings()

const gridRootStyle = computed(() => ({
  maxWidth: `${tabSettings.value.gridMaxWidth}${tabSettings.value.gridMaxWidthUnit}`,
}))
</script>

<style lang="scss" scoped>
.tab-grid {
  width: 100%;
  margin: 0 auto;
  transition: max-width 0.2s ease;
}

.tab-grid__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  transition: gap 0.2s ease;
}

.tab-grid__add {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: $radius-card;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
    transform: translateY(-2px);
  }
}

.tab-grid__add-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: $radius-md;
}

.tab-grid__add-name {
  font-size: 0.75rem;
  font-weight: 500;
}

.grid-flip-move {
  transition: transform 0.3s;
}
</style>
