<!--
  @file TabSidebarFloating.vue
  @description 标签页悬浮侧栏：脱离内容流，悬浮在视口左侧空白区域，支持折叠/展开
  @author TixXin
  @since 2026-04-11
-->

<template>
  <aside class="tab-side" :class="{ 'tab-side--collapsed': collapsed }" :style="sidebarStyle">
    <!-- 折叠/展开切换 -->
    <button type="button" class="tab-side__toggle" aria-label="折叠/展开" @click="collapsed = !collapsed">
      <Icon :name="collapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" size="14" />
    </button>

    <!-- 用户头像 + 名称 -->
    <div class="tab-side__header">
      <div class="tab-side__avatar">
        <Icon v-if="!user?.avatar" name="lucide:user" size="18" />
        <img v-else :src="user.avatar" :alt="user.nickname" >
      </div>
      <div v-if="!collapsed" class="tab-side__user">
        <div class="tab-side__name">{{ user?.nickname || '未登录' }}</div>
        <div class="tab-side__sub">{{ totalCount }} 个书签</div>
      </div>
    </div>

    <div class="tab-side__divider" />

    <!-- 分类列表（不再提供「全部」按钮，默认选中首个分类；支持拖拽排序） -->
    <nav ref="navEl" class="tab-side__nav">
      <button
        v-for="cat in localCategories"
        :key="cat.id"
        type="button"
        :data-category-id="cat.id"
        :title="collapsed ? cat.name : undefined"
        class="tab-side__cat"
        :class="{
          'tab-side__cat--active': activeId === cat.id,
          'tab-side__cat--drop': dropTargetId === cat.id,
        }"
        @click="emit('select', cat.id)"
        @contextmenu.prevent="onCategoryContextMenu($event, cat.id)"
        @dragenter.prevent="onDragEnter(cat.id)"
        @dragover.prevent="onDragOver($event)"
        @dragleave="onDragLeave(cat.id)"
        @drop.prevent="onDrop($event, cat.id)"
      >
        <Icon v-if="cat.icon" :name="cat.icon" size="15" class="tab-side__cat-icon" />
        <span v-if="!collapsed" class="tab-side__cat-name">{{ cat.name }}</span>
        <span v-if="!collapsed && tabSettings.showCounts" class="tab-side__cat-count">
          {{ counts[cat.id] || 0 }}
        </span>
      </button>
    </nav>

    <!-- 新建分类 -->
    <template v-if="!readOnly">
      <div class="tab-side__divider" />
      <CommonTooltip v-if="collapsed" content="新建分类" placement="right">
        <button type="button" class="tab-side__action tab-side__action--icon" @click="emit('addCategory')">
          <Icon name="lucide:folder-plus" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__action" @click="emit('addCategory')">
        <Icon name="lucide:folder-plus" size="14" />
        <span>新建分类</span>
      </button>
    </template>

    <!-- 底部弹性空间 + 功能按钮 -->
    <div class="tab-side__spacer" />
    <div class="tab-side__bottom">
      <CommonTooltip v-if="collapsed" content="设置" placement="right">
        <button type="button" class="tab-side__bottom-btn" @click="emit('openSettings')">
          <Icon name="lucide:settings" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__bottom-btn" @click="emit('openSettings')">
        <Icon name="lucide:settings" size="15" />
        <span v-if="!collapsed">设置</span>
      </button>

      <CommonTooltip v-if="collapsed" content="打赏" placement="right">
        <button type="button" class="tab-side__bottom-btn" @click="emit('openDonate')">
          <Icon name="lucide:heart" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__bottom-btn" @click="emit('openDonate')">
        <Icon name="lucide:heart" size="15" />
        <span v-if="!collapsed">打赏</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { BookmarkCategory, CategoryReorderUpdate } from '~/features/tab/types'
import type { CurrentUser } from '~/features/auth/types'

const props = defineProps<{
  user: CurrentUser | null
  categories: BookmarkCategory[]
  activeId: string | null
  counts: Record<string, number>
  totalCount: number
  readOnly?: boolean
}>()

const emit = defineEmits<{
  select: [id: string | null]
  addCategory: []
  removeCategory: [id: string]
  openSettings: []
  openDonate: []
  bookmarkDropped: [payload: { bookmarkId: string; targetCategoryId: string }]
  reorderCategories: [updates: CategoryReorderUpdate[]]
  categoryContextMenu: [payload: { categoryId: string; x: number; y: number }]
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })

const { settings: tabSettings } = useTabSettings()

/** 当前拖拽悬浮的分类 id（用于高亮 drop target） */
const dropTargetId = ref<string | null>(null)

/** 本地 mutable 分类副本，供 useSortable 修改 */
const navEl = ref<HTMLElement | null>(null)
const localCategories = ref<BookmarkCategory[]>([])

watch(
  () => props.categories,
  (val) => {
    localCategories.value = [...val]
  },
  { immediate: true },
)

const { start: startSortable, stop: stopSortable } = useSortable(navEl, localCategories, {
  animation: 150,
  draggable: '.tab-side__cat',
  ghostClass: 'tab-side__cat--ghost',
  chosenClass: 'tab-side__cat--chosen',
  forceFallback: false,
  onEnd: (evt) => {
    if (evt.to !== evt.from) return
    const updates: CategoryReorderUpdate[] = localCategories.value.map((c, i) => ({
      id: c.id,
      sortOrder: (i + 1) * 100,
    }))
    emit('reorderCategories', updates)
  },
})

watchEffect(() => {
  // 只读（未登录）或拖拽被关闭时禁用分类拖拽
  if (props.readOnly || !tabSettings.value.dragEnabled) stopSortable()
  else startSortable()
})

function onCategoryContextMenu(e: MouseEvent, categoryId: string) {
  emit('categoryContextMenu', { categoryId, x: e.clientX, y: e.clientY })
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
  emit('bookmarkDropped', { bookmarkId, targetCategoryId })
}

const sidebarStyle = computed(() => {
  const pct = Math.round(tabSettings.value.sidebarOpacity * 100)
  const blur = tabSettings.value.sidebarBlur
  return {
    borderRadius: `${tabSettings.value.sidebarRadius}px`,
    // 用 color-mix 调整背景透明度，避免 opacity 让文字/图标一起透
    background: `color-mix(in srgb, var(--surface-1) ${pct}%, transparent)`,
    backdropFilter: blur ? 'blur(14px) saturate(140%)' : 'none',
    WebkitBackdropFilter: blur ? 'blur(14px) saturate(140%)' : 'none',
  }
})
</script>

<style lang="scss" scoped>
$side-expanded: 160px;
$side-collapsed: 44px;

.tab-side {
  position: fixed;
  left: 1.25rem;
  top: 4rem;
  bottom: 0.75rem;
  z-index: 10;
  width: $side-expanded;
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  /* background 由 inline style（sidebarStyle）用 color-mix 动态控制透明度 */
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-elevated, var(--shadow-card));
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.25s ease, backdrop-filter 0.25s ease;

  @media (max-width: $breakpoint-lg) {
    display: none;
  }

  &--collapsed {
    width: $side-collapsed;
    padding: 0.75rem 0.375rem;

    .tab-side__header {
      justify-content: center;
    }

    .tab-side__cat {
      justify-content: center;
      padding: 0.4375rem;
    }

    .tab-side__divider {
      margin: 0.5rem 0;
    }
  }
}

/* ---- 折叠按钮 ---- */
.tab-side__toggle {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  .tab-side--collapsed & {
    position: static;
    align-self: center;
    margin-bottom: 0.25rem;
  }

  &:hover {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

/* ---- 头像区 ---- */
.tab-side__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.tab-side__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent);
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.tab-side__user {
  flex: 1;
  min-width: 0;
}

.tab-side__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__sub {
  font-size: 0.625rem;
  color: var(--text-soft);
  margin-top: 0.0625rem;
}

/* ---- 分割线 ---- */
.tab-side__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.75rem 0;
}

/* ---- 分类列表 ---- */
.tab-side__nav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tab-side__cat {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-main);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--surface-2);

    .tab-side__cat-remove {
      opacity: 1;
    }
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  // 拖拽 drop target 高亮（跨分类拖拽书签时使用）
  &--drop {
    background: var(--accent-soft);
    outline: 2px dashed var(--accent);
    outline-offset: -2px;
  }

  // 分类被拖起的原位占位样式
  &--ghost {
    opacity: 0.35;
    background: var(--surface-2);
  }

  &--chosen {
    z-index: 2;
  }
}

.tab-side__cat-icon {
  flex-shrink: 0;
  color: var(--text-soft);
}

.tab-side__cat--active .tab-side__cat-icon {
  color: var(--accent);
}

.tab-side__cat-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__cat-count {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.tab-side__cat-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 0.125rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-3, var(--surface-2));
    color: var(--accent);
  }
}

/* ---- 新建分类 ---- */
.tab-side__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.4375rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  &--icon {
    padding: 0.4375rem;
  }
}

/* ---- 底部弹性空间 + 功能按钮 ---- */
.tab-side__spacer {
  flex: 1;
}

.tab-side__bottom {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-soft);
}

.tab-side__bottom-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  .tab-side--collapsed & {
    justify-content: center;
    padding: 0.4375rem;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}
</style>
