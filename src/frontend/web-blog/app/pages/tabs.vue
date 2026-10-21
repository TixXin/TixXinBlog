<!--
  @file tabs.vue
  @description 标签页主页：通过 fullbleed 模式让 default layout 隐藏左右两栏，
               StatusFooter 不动；未登录回退展示博主的标签页（只读）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tabs-page">
    <!-- 壁纸层：自身内部 Teleport 到 body，z-index:-1 -->
    <TabWallpaperLayer />

    <!-- Teleport 到 body，避免 .main-content 祖先链上的 transform/filter 破坏 position:fixed -->
    <ClientOnly>
      <Teleport to="body">
        <TabSidebarFloating
          v-model:collapsed="sidebarCollapsed"
          :user="displayUser"
          :categories="categories"
          :active-id="activeCategoryId"
          :counts="categoryCounts"
          :total-count="bookmarks.length"
          :read-only="isReadOnly"
          @select="selectCategory"
          @add-category="onAddCategoryClick"
          @remove-category="onRemoveCategory"
          @open-settings="settingsOpen = true"
          @open-donate="onDonate"
          @bookmark-dropped="onBookmarkDropped"
          @reorder-categories="onReorderCategories"
          @category-context-menu="onCategoryContextMenu"
        />
      </Teleport>
    </ClientOnly>

    <div class="tabs-page__center" @contextmenu.self.prevent="onBlankContextMenu">
      <!-- 初次读取失败走统一重试；排序未保存仍是就地提示，避免重试把警告清掉。 -->
      <CommonRequestFeedback
        v-if="bookmarkLoadFailed"
        compact
        :pending="bookmarkLoading"
        :title="$t('misc.tab.page.loadFailed')"
        :description="storageError || $t('misc.tab.page.loadFailedDescription')"
        @retry="retryBookmarks"
      />
      <p v-else-if="storageError" role="alert">{{ storageError }}</p>
      <TabGreetingHeader :settings="tabSettings" :current-user="currentUser" :is-logged-in="isLoggedIn" />

      <TabSearchBar />
      <TabCompactTools
        :categories="categories"
        :active-category-id="activeCategoryId"
        :category-counts="categoryCounts"
        :is-read-only="isReadOnly"
        :settings-open="settingsOpen"
        @select-category="selectCategory"
        @open-settings="settingsOpen = true"
        @add-category="onAddCategoryClick"
      />
      <p class="tabs-page__storage-note">{{ $t('misc.tab.page.storageNote') }}</p>

      <div class="tabs-page__panel" @contextmenu.self.prevent="onBlankContextMenu">
        <TabBookmarkGrid
          :bookmarks="visibleBookmarks"
          :read-only="isReadOnly"
          @add="onAddBookmarkClick"
          @remove="onRemoveBookmark"
          @reorder="onReorder"
          @context-menu="onBookmarkContextMenu"
          @read-only-blocked="onReadOnlyBlocked"
        />
      </div>
    </div>

    <TabAddBookmarkDialog
      v-model:visible="addBookmarkVisible"
      :categories="categories"
      :default-category-id="activeCategoryId"
      :initial="editingBookmark"
      @submit="onSubmitBookmark"
      @update="onUpdateBookmarkFromDialog"
    />

    <TabContextMenu
      :visible="ctxVisible"
      :x="ctxX"
      :y="ctxY"
      :items="ctxItems"
      :focus-key="ctxFocusKey"
      @close="ctxVisible = false"
    />
    <TabAddCategoryDialog v-model:visible="addCategoryVisible" @submit="onSubmitCategory" />
    <TabSettingsDrawer v-model:visible="settingsOpen" :user="displayUser" @open-import="importOpen = true" />

    <TabImportDialog v-model:visible="importOpen" />

    <TabCommandPalette :actions="paletteActions" />

    <TabGuestNotice :is-read-only="isReadOnly" @login="openLoginDrawer('login', true)" />
  </div>
</template>

<script setup lang="ts">
import { mockOwnerUser } from '~/features/auth/mock'
import { useTabBookmarkOperations } from '~/features/tab/useTabBookmarkOperations'
import { useTabPaletteActions } from '~/features/tab/useTabPaletteActions'
import { useTabContextMenu } from '~/features/tab/useTabContextMenu'

definePageMeta({ fullbleed: true })

const { t } = useI18n()

usePageSeo({
  title: () => t('misc.tab.page.seoTitle'),
  description: () => t('misc.tab.page.seoDescription'),
})

const { currentUser, isLoggedIn } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const {
  error: storageError,
  loaded: bookmarksLoaded,
  loading: bookmarkLoading,
  categories,
  bookmarks,
  visibleBookmarks,
  categoryCounts,
  activeCategoryId,
  isReadOnly,
  load,
  selectCategory,
  addBookmark,
  updateBookmark,
  removeBookmark,
  addCategory,
  removeCategory,
  reorderBookmarks,
  reorderCategories,
  refreshFavicon,
} = useTabBookmarks()

const bookmarkRetrying = ref(false)
const bookmarkLoadFailed = computed(() => bookmarkRetrying.value || (!bookmarksLoaded.value && !!storageError.value))

async function retryBookmarks() {
  if (bookmarkLoading.value) return
  bookmarkRetrying.value = true
  try {
    await load(true)
  } finally {
    bookmarkRetrying.value = false
  }
}

const { settings: tabSettings } = useTabSettings()
const sidebarCollapsed = ref(tabSettings.value.defaultCollapsed)

/** 侧栏展示用：未登录时显示博主信息 */
const displayUser = computed(() => currentUser.value ?? mockOwnerUser)

watch(
  () => tabSettings.value.defaultCollapsed,
  (v) => {
    sidebarCollapsed.value = v
  },
)

onMounted(() => {
  void load()
})

watch(isLoggedIn, () => {
  void load(true)
})

// 书签与分类交互流程
const {
  addBookmarkVisible,
  addCategoryVisible,
  settingsOpen,
  importOpen,
  onAddBookmarkClick,
  onAddCategoryClick,
  onSubmitBookmark,
  onUpdateBookmarkFromDialog,
  onRemoveBookmark,
  onSubmitCategory,
  onRemoveCategory,
  onReorder,
  onReorderCategories,
  onReadOnlyBlocked,
  onDonate,
  onBookmarkDropped,
} = useTabBookmarkOperations({
  isLoggedIn,
  openLoginDrawer,
  bookmarks,
  addBookmark,
  updateBookmark,
  removeBookmark,
  addCategory,
  removeCategory,
  reorderBookmarks,
  reorderCategories,
})

// 命令面板动作项
const { paletteActions } = useTabPaletteActions({
  onAddBookmark: onAddBookmarkClick,
  onAddCategory: onAddCategoryClick,
  onOpenSettings: () => {
    settingsOpen.value = true
  },
  onOpenImport: () => {
    importOpen.value = true
  },
})

// 上下文菜单
const {
  ctxVisible,
  ctxX,
  ctxY,
  ctxItems,
  ctxFocusKey,
  editingBookmark,
  onBookmarkContextMenu,
  onCategoryContextMenu,
  onBlankContextMenu,
} = useTabContextMenu({
  categories,
  isReadOnly,
  onAddBookmark: onAddBookmarkClick,
  onAddCategory: onAddCategoryClick,
  onEditBookmark: (bm) => {
    editingBookmark.value = bm
    addBookmarkVisible.value = true
  },
  onOpenSettings: () => {
    settingsOpen.value = true
  },
  onOpenLogin: (view) => openLoginDrawer(view ?? 'login'),
  onRemoveCategory,
  onRemoveBookmark,
  onUpdateBookmark: (id, patch) => updateBookmark(id, patch),
  onRefreshFavicon: (id) => refreshFavicon(id),
  onSelectCategory: (id) => selectCategory(id),
})

// 编辑 Dialog 关闭时清理 editingBookmark
watch(addBookmarkVisible, (v) => {
  if (!v) editingBookmark.value = null
})
</script>

<style lang="scss" scoped>
.tabs-page {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 悬浮侧栏不占文档流，内容区自然居中，无需 padding-left */
}

.tabs-page__center {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 3.5rem 1.5rem 2.5rem;
  gap: 1.75rem;
  width: 100%;
  margin: 0 auto;
}

.tabs-page__panel {
  width: 100%;
  padding: 0.5rem 0;
}

.tabs-page__storage-note {
  color: var(--text-soft);
  font-size: 0.8125rem;
}
</style>
