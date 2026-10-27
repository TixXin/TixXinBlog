<!--
  @file TabSidebarFloating.vue
  @description 标签页悬浮侧栏：脱离内容流，悬浮在视口左侧空白区域，支持折叠/展开
  @author TixXin
  @since 2026-04-11
-->

<!--
  @file TabSidebarFloating.vue
  @description 标签页悬浮侧栏：脱离内容流，悬浮在视口左侧空白区域，支持折叠/展开
  @author TixXin
  @since 2026-04-11
-->

<template>
  <aside class="tab-side" :class="{ 'tab-side--collapsed': collapsed }" :style="sidebarStyle">
    <!-- 折叠/展开切换 -->
    <button
      type="button"
      class="tab-side__toggle"
      :aria-label="$t('misc.tab.sidebar.toggle')"
      @click="collapsed = !collapsed"
    >
      <Icon :name="collapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" size="14" />
    </button>

    <!-- 用户头像 + 名称 -->
    <div class="tab-side__header">
      <div class="tab-side__avatar">
        <Icon v-if="!user?.avatar" name="lucide:user" size="18" />
        <img v-else :src="user.avatar" :alt="user.nickname" />
      </div>
      <div v-if="!collapsed" class="tab-side__user">
        <div class="tab-side__name">{{ user?.nickname || $t('misc.tab.sidebar.notLoggedIn') }}</div>
        <div class="tab-side__sub">{{ $t('misc.tab.common.bookmarkCount', { count: totalCount }, totalCount) }}</div>
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
        :data-focus-key="`category:${cat.id}`"
        :title="collapsed ? cat.name : undefined"
        :aria-label="
          $t('misc.tab.sidebar.categoryLabel', {
            name: cat.name,
            count: $t('misc.tab.common.bookmarkCount', { count: counts[cat.id] || 0 }, counts[cat.id] || 0),
          })
        "
        :aria-pressed="activeId === cat.id"
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
        @keydown.alt.up.prevent.stop="moveCategory(cat.id, -1)"
        @keydown.alt.down.prevent.stop="moveCategory(cat.id, 1)"
      >
        <Icon v-if="cat.icon" :name="cat.icon" size="15" class="tab-side__cat-icon" />
        <span v-if="!collapsed" class="tab-side__cat-name">{{ cat.name }}</span>
        <!-- 名称与数量之间保留空白文本，否则可见文字连成“AI10”，与可访问名对不上；弹性布局中不占位 -->
        <template v-if="!collapsed && tabSettings.showCounts">{{ ' ' }}</template>
        <span v-if="!collapsed && tabSettings.showCounts" class="tab-side__cat-count">
          {{ counts[cat.id] || 0 }}
        </span>
      </button>
    </nav>

    <!-- 新建分类 -->
    <TabSidebarAddCategory v-if="!readOnly" :collapsed="collapsed" @add="emit('addCategory')" />

    <!-- 底部弹性空间 + 功能按钮 -->
    <div class="tab-side__spacer" />
    <TabSidebarBottom :collapsed="collapsed" @settings="emit('openSettings')" @donate="emit('openDonate')" />
  </aside>
</template>

<script setup lang="ts">
import TabSidebarAddCategory from './TabSidebarAddCategory.vue'
import TabSidebarBottom from './TabSidebarBottom.vue'
import type { BookmarkCategory, CategoryReorderUpdate } from '~/features/tab/types'
import type { CurrentUser } from '~/features/auth/types'
import { tabSidebarStyle, useTabSidebarCategories } from '~/features/tab/useTabSidebarCategories'

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

const navEl = ref<HTMLElement | null>(null)
const { dropTargetId, localCategories, moveCategory, onDragEnter, onDragOver, onDragLeave, onDrop } =
  useTabSidebarCategories({
    props,
    settings: tabSettings,
    navEl,
    onReorder: (updates) => emit('reorderCategories', updates),
    onBookmarkDropped: (payload) => emit('bookmarkDropped', payload),
  })

function onCategoryContextMenu(e: MouseEvent, categoryId: string) {
  emit('categoryContextMenu', { categoryId, x: e.clientX, y: e.clientY })
}

const sidebarStyle = computed(() => tabSidebarStyle(tabSettings.value))
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-sidebar' as sidebar;

@include sidebar.sidebar;
</style>
