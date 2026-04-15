<!--
  @file TabBookmarkGrid.vue
  @description 标签页书签网格容器：包含 + 按钮，内部接入 useSortable 做同分类内拖拽排序
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tab-grid" :class="viewClass" :style="gridRootStyle">
    <div ref="listEl" class="tab-grid__list" :style="listStyle">
      <TabBookmarkItem
        v-for="bm in localList"
        :key="bm.id"
        :bookmark="bm"
        :read-only="readOnly"
        :view-mode="tabSettings.viewMode"
        :data-bookmark-id="bm.id"
        @remove="emit('remove', $event)"
      />
      <button v-if="!readOnly" key="__add" type="button" class="tab-grid__add" @click="emit('add')">
        <span class="tab-grid__add-icon">
          <Icon name="lucide:plus" size="22" />
        </span>
        <span class="tab-grid__add-name">添加</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { Bookmark, BookmarkReorderUpdate } from '~/features/tab/types'

const props = defineProps<{ bookmarks: Bookmark[]; readOnly?: boolean }>()
const emit = defineEmits<{
  add: []
  remove: [id: string]
  reorder: [updates: BookmarkReorderUpdate[]]
}>()

const { settings: tabSettings } = useTabSettings()

// 本地 mutable 副本：useSortable 需要直接改动数组；外部 props 变化时同步
const listEl = ref<HTMLElement | null>(null)
const localList = ref<Bookmark[]>([])

watch(
  () => props.bookmarks,
  (val) => {
    localList.value = [...val]
  },
  { immediate: true },
)

const { start, stop } = useSortable(listEl, localList, {
  animation: 150,
  handle: '.tab-bm',
  filter: '.tab-grid__add',
  ghostClass: 'tab-bm--ghost',
  chosenClass: 'tab-bm--chosen',
  dragClass: 'tab-bm--dragging',
  // forceFallback=false：使用 HTML5 drag，允许跨分类拖拽（侧栏 drop zone 生效）
  forceFallback: false,
  onEnd: (evt) => {
    // 跨分类拖拽由外部 drop zone 处理，此处仅关心同分类排序
    if (evt.to !== evt.from) return
    const updates: BookmarkReorderUpdate[] = localList.value.map((b, i) => ({
      id: b.id,
      categoryId: b.categoryId,
      sortOrder: (i + 1) * 100,
    }))
    emit('reorder', updates)
  },
})

// 只读或拖拽开关关闭时禁用 sortable
watchEffect(() => {
  if (props.readOnly || !tabSettings.value.dragEnabled) stop()
  else start()
})

const gridRootStyle = computed(() => ({
  maxWidth: `${tabSettings.value.gridMaxWidth}${tabSettings.value.gridMaxWidthUnit}`,
}))

const viewClass = computed(() => `tab-grid--${tabSettings.value.viewMode}`)

const listStyle = computed(() => {
  const gap = `${tabSettings.value.iconGap}px`
  const cols = tabSettings.value.gridColumns
  const mode = tabSettings.value.viewMode
  if (mode === 'list') return { gap }
  // 固定列数优先（仅 grid/compact 生效）
  if (typeof cols === 'number' && (mode === 'grid' || mode === 'compact')) {
    return { gap, gridTemplateColumns: `repeat(${cols}, 1fr)` }
  }
  return { gap }
})
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

/* compact：小图标密排 */
.tab-grid--compact .tab-grid__list {
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
}

/* list：纵向一列，行式布局 */
.tab-grid--list .tab-grid__list {
  display: flex;
  flex-direction: column;
}

/* cards：宽卡片带描述 */
.tab-grid--cards .tab-grid__list {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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

/* ---- SortableJS 拖拽态样式 ---- */
:deep(.tab-bm--ghost) {
  opacity: 0.35;
  background: var(--surface-2);
}

:deep(.tab-bm--chosen) {
  z-index: 2;
}

:deep(.tab-bm--dragging) {
  box-shadow: var(--shadow-elevated, 0 12px 24px rgba(0, 0, 0, 0.25));
  transform: scale(1.05);
}
</style>
