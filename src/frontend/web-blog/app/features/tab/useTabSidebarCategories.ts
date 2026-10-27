/**
 * @file useTabSidebarCategories.ts
 * @description 悬浮侧栏的分类列表：本地可排序副本、指针拖拽与 Alt+方向键排序、书签拖放到分类，以及按设置计算的侧栏外观
 * @author TixXin
 * @since 2026-10-27
 */
import type { Ref } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { BookmarkCategory, CategoryReorderUpdate } from './types'
import type { TabSettings } from '~/composables/useTabSettings'

interface SidebarCategoryOptions {
  props: { categories: BookmarkCategory[]; readOnly?: boolean }
  settings: Ref<TabSettings>
  navEl: Ref<HTMLElement | null>
  onReorder: (updates: CategoryReorderUpdate[]) => void
  onBookmarkDropped: (payload: { bookmarkId: string; targetCategoryId: string }) => void
}

/** 按当前顺序重新编排排序值，间隔 100 */
const reorderUpdates = (list: BookmarkCategory[]): CategoryReorderUpdate[] =>
  list.map((c, i) => ({ id: c.id, sortOrder: (i + 1) * 100 }))

/** 侧栏圆角、背景透明度与毛玻璃；用 color-mix 调整背景透明度，避免 opacity 让文字/图标一起透 */
export function tabSidebarStyle(settings: TabSettings) {
  const pct = Math.round(settings.sidebarOpacity * 100)
  const blur = settings.sidebarBlur
  return {
    borderRadius: `${settings.sidebarRadius}px`,
    background: `color-mix(in srgb, var(--surface-1) ${pct}%, transparent)`,
    backdropFilter: blur ? 'blur(14px) saturate(140%)' : 'none',
    WebkitBackdropFilter: blur ? 'blur(14px) saturate(140%)' : 'none',
  }
}

/** 指针拖拽排序：只读或关闭拖拽时停用，减少动效时去掉动画 */
function useCategorySortable(options: SidebarCategoryOptions, localCategories: Ref<BookmarkCategory[]>) {
  const { props, settings, navEl, onReorder } = options
  const { reducedMotion } = useMotionPreference()
  const {
    start: startSortable,
    stop: stopSortable,
    option,
  } = useSortable(navEl, localCategories, {
    animation: 150,
    draggable: '.tab-side__cat',
    ghostClass: 'tab-side__cat--ghost',
    chosenClass: 'tab-side__cat--chosen',
    forceFallback: false,
    onEnd: async (evt) => {
      if (evt.to !== evt.from) return
      await nextTick()
      onReorder(reorderUpdates(localCategories.value))
      await nextTick()
      localCategories.value = [...props.categories]
    },
  })
  watchEffect(() => {
    // 只读（未登录）或拖拽被关闭时禁用分类拖拽
    if (props.readOnly || !settings.value.dragEnabled) stopSortable()
    else startSortable()
    option('animation', reducedMotion.value ? 0 : 150)
  })
}

export function useTabSidebarCategories(options: SidebarCategoryOptions) {
  const { props, navEl, onReorder, onBookmarkDropped } = options
  /** 当前拖拽悬浮的分类 id（用于高亮 drop target） */
  const dropTargetId = ref<string | null>(null)
  /** 本地 mutable 分类副本，供 useSortable 修改 */
  const localCategories = ref<BookmarkCategory[]>([])
  watch(
    () => props.categories,
    (val) => {
      localCategories.value = [...val]
    },
    { immediate: true },
  )
  useCategorySortable(options, localCategories)

  async function moveCategory(id: string, direction: -1 | 1) {
    if (props.readOnly) return
    const index = localCategories.value.findIndex((category) => category.id === id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= localCategories.value.length) return
    const reordered = [...localCategories.value]
    const [category] = reordered.splice(index, 1)
    reordered.splice(next, 0, category!)
    onReorder(reorderUpdates(reordered))
    await nextTick()
    localCategories.value = [...props.categories]
    await nextTick()
    const target = [...(navEl.value?.children ?? [])].find((node) => (node as HTMLElement).dataset.categoryId === id)
    ;(target as HTMLElement | undefined)?.focus({ preventScroll: true })
  }
  function onDragEnter(catId: string) {
    dropTargetId.value = catId
  }
  function onDragOver(e: DragEvent) {
    // 必须阻止默认才能触发 drop
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
  function onDragLeave(catId: string) {
    if (dropTargetId.value === catId) dropTargetId.value = null
  }
  function onDrop(e: DragEvent, targetCategoryId: string) {
    dropTargetId.value = null
    const bookmarkId = e.dataTransfer?.getData('application/x-bookmark-id')
    if (!bookmarkId) return
    onBookmarkDropped({ bookmarkId, targetCategoryId })
  }
  return { dropTargetId, localCategories, moveCategory, onDragEnter, onDragOver, onDragLeave, onDrop }
}
