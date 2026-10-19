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
      <div v-if="tabSettings.showGreeting || tabSettings.showDate" class="tabs-page__greeting">
        <h1 v-if="tabSettings.showGreeting" class="tabs-page__hello">{{ greetingLine }}</h1>
        <p v-if="tabSettings.showDate" class="tabs-page__date">{{ today }}</p>
      </div>

      <TabSearchBar />
      <div class="tabs-page__compact-tools">
        <label for="bookmark-group">{{ $t('misc.tab.page.groupLabel') }}</label>
        <select
          id="bookmark-group"
          :value="activeCategoryId ?? ''"
          @change="selectCategory(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">{{ $t('misc.tab.page.allBookmarks') }}</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ $t('misc.tab.page.groupOption', { name: category.name, count: categoryCounts[category.id] || 0 }) }}
          </option>
        </select>
        <button type="button" aria-haspopup="dialog" :aria-expanded="settingsOpen" @click="settingsOpen = true">
          <Icon name="lucide:settings" size="18" />{{ $t('misc.tab.page.settings') }}
        </button>
        <button v-if="!isReadOnly" type="button" @click="onAddCategoryClick">
          <Icon name="lucide:folder-plus" size="18" />{{ $t('misc.tab.page.newCategory') }}
        </button>
      </div>
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

    <!-- 游客提示：Teleport 到 body，避免祖先 transform 破坏 fixed 定位 -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="tabs-guest-toast">
          <div v-if="isReadOnly && !guestToastDismissed" class="tabs-guest-toast">
            <Icon name="lucide:info" size="14" class="tabs-guest-toast__icon" />
            <span class="tabs-guest-toast__text">{{ $t('misc.tab.page.guestBrowsing') }}</span>
            <button type="button" class="tabs-guest-toast__login" @click="onLogin">
              {{ $t('misc.tab.page.login') }}
              <Icon name="lucide:log-in" size="11" />
            </button>
            <button
              type="button"
              class="tabs-guest-toast__close"
              :aria-label="$t('misc.tab.page.close')"
              @click="guestToastDismissed = true"
            >
              <Icon name="lucide:x" size="12" />
            </button>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type {
  Bookmark,
  BookmarkDraft,
  BookmarkCategoryDraft,
  BookmarkReorderUpdate,
  CategoryReorderUpdate,
} from '~/features/tab/types'
import type { TabViewMode } from '~/composables/useTabSettings'
import type { CommandAction } from '~/components/tab/TabCommandPalette.vue'
import type { ContextMenuItem } from '~/components/tab/TabContextMenu.vue'
import { mockOwnerUser } from '~/features/auth/mock'

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

const { success, info, error: showError } = useToast()
const tabPalette = useTabCommandPalette()
const tabRepo = useTabRepository()

const guestToastDismissed = ref(false)
const addBookmarkVisible = ref(false)
const addCategoryVisible = ref(false)
const settingsOpen = ref(false)
const importOpen = ref(false)
const { settings: tabSettings, update: updateSetting } = useTabSettings()
const sidebarCollapsed = ref(tabSettings.value.defaultCollapsed)

/** 命令面板 actions：内建固定项（新建、切视图、打开设置、壁纸等） */
const paletteActions = computed<CommandAction[]>(() => {
  const switchView = (mode: TabViewMode): CommandAction => ({
    id: `view-${mode}`,
    title: t('misc.tab.palette.switchView', { view: viewLabel(mode) }),
    subtitle: tabSettings.value.viewMode === mode ? t('misc.tab.palette.currentView') : '',
    icon: viewIcon(mode),
    section: 'actions',
    run: () => updateSetting('viewMode', mode),
  })
  return [
    {
      id: 'add-bookmark',
      title: t('misc.tab.palette.addBookmark'),
      subtitle: t('misc.tab.palette.addBookmarkSubtitle'),
      icon: 'lucide:plus',
      shortcut: 'N',
      section: 'actions',
      run: () => onAddBookmarkClick(),
    },
    {
      id: 'add-category',
      title: t('misc.tab.palette.addCategory'),
      icon: 'lucide:folder-plus',
      section: 'actions',
      run: () => {
        addCategoryVisible.value = true
      },
    },
    switchView('grid'),
    switchView('compact'),
    switchView('list'),
    switchView('cards'),
    {
      id: 'open-settings',
      title: t('misc.tab.palette.openSettings'),
      icon: 'lucide:settings',
      section: 'actions',
      run: () => {
        settingsOpen.value = true
      },
    },
    {
      id: 'toggle-drag',
      title: tabSettings.value.dragEnabled ? t('misc.tab.palette.disableDrag') : t('misc.tab.palette.enableDrag'),
      icon: 'lucide:move',
      section: 'actions',
      run: () => updateSetting('dragEnabled', !tabSettings.value.dragEnabled),
    },
    {
      id: 'import',
      title: t('misc.tab.palette.import'),
      subtitle: t('misc.tab.palette.importSubtitle'),
      icon: 'lucide:upload',
      section: 'actions',
      run: () => {
        importOpen.value = true
      },
    },
  ]
})

function viewLabel(mode: TabViewMode): string {
  return t(`misc.tab.viewMode.${mode}`)
}

function viewIcon(mode: TabViewMode): string {
  switch (mode) {
    case 'grid':
      return 'lucide:layout-grid'
    case 'compact':
      return 'lucide:grid-2x2'
    case 'list':
      return 'lucide:list'
    case 'cards':
      return 'lucide:square-stack'
  }
}

/** 侧栏与问候语用：未登录时显示博主信息 */
const displayUser = computed(() => currentUser.value ?? mockOwnerUser)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return t('misc.tab.page.greeting.lateNight')
  if (h < 11) return t('misc.tab.page.greeting.morning')
  if (h < 14) return t('misc.tab.page.greeting.noon')
  if (h < 18) return t('misc.tab.page.greeting.afternoon')
  if (h < 22) return t('misc.tab.page.greeting.evening')
  return t('misc.tab.page.greeting.lateNight')
})

const greetingLine = computed(() => {
  if (!isLoggedIn.value) return t('misc.tab.page.guestWelcome', { name: mockOwnerUser.nickname })
  return t('misc.tab.page.greetingLine', { greeting: greeting.value, name: currentUser.value?.nickname ?? '' })
})

const today = computed(() => {
  const d = new Date()
  let str = t('misc.tab.page.date', {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    monthName: formatDate(d, { month: 'long' }),
    day: d.getDate(),
    weekday: formatDate(d, { weekday: 'long' }),
  })
  if (tabSettings.value.showSeconds) {
    str += ` · ${formatDateTime(d, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }
  return str
})

// 设置中的默认折叠变化时同步侧边栏
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

function onLogin() {
  openLoginDrawer('login', true)
}

function onAddBookmarkClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  addBookmarkVisible.value = true
}

async function onSubmitBookmark(draft: BookmarkDraft) {
  try {
    if (await addBookmark(draft)) addBookmarkVisible.value = false
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('misc.tab.page.saveFailed'))
  }
}

async function onRemoveBookmark(id: string) {
  await removeBookmark(id)
}

async function onSubmitCategory(draft: BookmarkCategoryDraft) {
  await addCategory(draft)
}

function onDonate() {
  // 打赏功能占位，后续实现
}

async function onRemoveCategory(id: string) {
  if (!window.confirm(t('misc.tab.page.removeCategoryConfirm'))) return
  await removeCategory(id)
}

async function onReorder(updates: BookmarkReorderUpdate[]) {
  await reorderBookmarks(updates)
}

async function onUpdateBookmarkFromDialog(payload: { id: string; patch: BookmarkDraft }) {
  try {
    if (await updateBookmark(payload.id, payload.patch)) addBookmarkVisible.value = false
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('misc.tab.page.saveFailed'))
  }
}

// ---- 上下文菜单 ----
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxItems = ref<ContextMenuItem[]>([])
const ctxFocusKey = ref<string | undefined>()
const editingBookmark = ref<Bookmark | null>(null)

const copyToClipboard = async (text: string, msg = t('misc.tab.menu.urlCopied')) => {
  try {
    await navigator.clipboard.writeText(text)
    success(msg)
  } catch {
    // clipboard 可能被禁用（非 HTTPS / 禁用）
  }
}

function onBookmarkContextMenu(payload: { bookmark: Bookmark; x: number; y: number }) {
  const bm = payload.bookmark
  ctxFocusKey.value = `bookmark:${bm.id}`
  ctxX.value = payload.x
  ctxY.value = payload.y

  // 只读模式：仅保留查看类动作，修改类动作引导登录
  if (isReadOnly.value) {
    ctxItems.value = [
      {
        label: t('misc.tab.menu.openNewTab'),
        icon: 'lucide:external-link',
        run: () => window.open(bm.url, '_blank', 'noopener'),
      },
      {
        label: t('misc.tab.menu.copyUrl'),
        icon: 'lucide:clipboard',
        run: () => copyToClipboard(bm.url),
      },
      { type: 'divider' },
      {
        label: t('misc.tab.menu.loginToEdit'),
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
    ctxVisible.value = true
    return
  }

  ctxItems.value = [
    {
      label: t('misc.tab.menu.openNewTab'),
      icon: 'lucide:external-link',
      run: () => window.open(bm.url, '_blank', 'noopener'),
    },
    {
      label: t('misc.tab.menu.edit'),
      icon: 'lucide:edit-3',
      run: () => {
        editingBookmark.value = bm
        addBookmarkVisible.value = true
      },
    },
    {
      label: t('misc.tab.menu.copyUrl'),
      icon: 'lucide:clipboard',
      run: () => copyToClipboard(bm.url),
    },
    {
      label: bm.pinned ? t('misc.tab.menu.unpin') : t('misc.tab.menu.pin'),
      icon: bm.pinned ? 'lucide:pin-off' : 'lucide:pin',
      run: () => updateBookmark(bm.id, { pinned: !bm.pinned }),
    },
    {
      label: t('misc.tab.menu.refreshFavicon'),
      icon: 'lucide:refresh-cw',
      run: () => refreshFavicon(bm.id),
    },
    {
      label: t('misc.tab.menu.moveTo'),
      icon: 'lucide:folder-symlink',
      submenu: categories.value
        .filter((c) => c.id !== bm.categoryId)
        .map((c) => ({
          label: c.name,
          icon: c.icon,
          run: () => updateBookmark(bm.id, { categoryId: c.id }),
        })),
    },
    { type: 'divider' },
    {
      label: t('misc.tab.menu.remove'),
      icon: 'lucide:trash-2',
      danger: true,
      run: () => removeBookmark(bm.id),
    },
  ]
  ctxVisible.value = true
}

/** 分类右键菜单 */
function onCategoryContextMenu(payload: { categoryId: string; x: number; y: number }) {
  const cat = categories.value.find((c) => c.id === payload.categoryId)
  if (!cat) return
  ctxFocusKey.value = `category:${cat.id}`
  ctxX.value = payload.x
  ctxY.value = payload.y

  if (isReadOnly.value) {
    ctxItems.value = [
      {
        label: t('misc.tab.menu.viewCategory'),
        icon: 'lucide:eye',
        run: () => selectCategory(cat.id),
      },
      { type: 'divider' },
      {
        label: t('misc.tab.menu.loginToEditCategory'),
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
    ctxVisible.value = true
    return
  }

  ctxItems.value = [
    {
      label: t('misc.tab.menu.openCategory'),
      icon: 'lucide:eye',
      run: () => selectCategory(cat.id),
    },
    {
      label: t('misc.tab.menu.rename'),
      icon: 'lucide:edit-3',
      run: async () => {
        const next = window.prompt(t('misc.tab.menu.renamePrompt'), cat.name)?.trim()
        if (next && next !== cat.name) {
          await updateCategoryMeta(cat.id, { name: next })
        }
      },
    },
    {
      label: t('misc.tab.menu.changeIcon'),
      icon: 'lucide:shapes',
      run: async () => {
        const next = window.prompt(t('misc.tab.menu.iconPrompt'), cat.icon || '')?.trim()
        if (next) await updateCategoryMeta(cat.id, { icon: next })
      },
    },
    { type: 'divider' },
    {
      label: t('misc.tab.menu.removeCategory'),
      icon: 'lucide:trash-2',
      danger: true,
      run: () => onRemoveCategory(cat.id),
    },
  ]
  ctxVisible.value = true
}

/** 空白区右键菜单（未登录时也可用，以只读动作为主） */
function onBlankContextMenu(e: MouseEvent) {
  ctxFocusKey.value = undefined
  ctxX.value = e.clientX
  ctxY.value = e.clientY

  const common: ContextMenuItem[] = [
    {
      label: t('misc.tab.menu.openPalette'),
      icon: 'lucide:command',
      shortcut: 'Ctrl+K',
      run: () => tabPalette.open(),
    },
    {
      label: t('misc.tab.menu.openSettings'),
      icon: 'lucide:settings',
      run: () => {
        settingsOpen.value = true
      },
    },
    {
      label: t('misc.tab.menu.switchView'),
      icon: 'lucide:layout-grid',
      submenu: (['grid', 'compact', 'list', 'cards'] as TabViewMode[]).map((m) => ({
        label: viewLabel(m),
        icon: viewIcon(m),
        run: () => updateSetting('viewMode', m),
      })),
    },
  ]

  if (isReadOnly.value) {
    ctxItems.value = [
      ...common,
      { type: 'divider' },
      {
        label: t('misc.tab.menu.loginToAdd'),
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
  } else {
    ctxItems.value = [
      {
        label: t('misc.tab.menu.addBookmark'),
        icon: 'lucide:plus',
        run: () => onAddBookmarkClick(),
      },
      {
        label: t('misc.tab.menu.addCategory'),
        icon: 'lucide:folder-plus',
        run: () => {
          addCategoryVisible.value = true
        },
      },
      { type: 'divider' },
      ...common,
    ]
  }
  ctxVisible.value = true
}

/** 分类元信息更新（封装 repo.updateCategory，tabBookmarks 当前未暴露 updateCategory） */
async function updateCategoryMeta(id: string, patch: Partial<{ name: string; icon: string; color: string }>) {
  const updated = await tabRepo.updateCategory(id, patch)
  const idx = categories.value.findIndex((c) => c.id === id)
  if (idx !== -1) {
    const next = [...categories.value]
    next[idx] = updated
    categories.value = next
  }
}

/** 分类拖拽排序 */
async function onReorderCategories(updates: CategoryReorderUpdate[]) {
  await reorderCategories(updates)
}

/** 只读模式下被 Grid 拦截的拖拽动作 */
function onReadOnlyBlocked() {
  info(t('misc.tab.page.readOnlyBlocked'))
}

function onAddCategoryClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  addCategoryVisible.value = true
}

// 编辑 Dialog 关闭时清理 editingBookmark
watch(addBookmarkVisible, (v) => {
  if (!v) editingBookmark.value = null
})

/** 跨分类拖拽：侧栏分类按钮 drop 后调用 */
async function onBookmarkDropped(payload: { bookmarkId: string; targetCategoryId: string }) {
  const current = bookmarks.value.find((b) => b.id === payload.bookmarkId)
  if (!current || current.categoryId === payload.targetCategoryId) return
  await updateBookmark(payload.bookmarkId, { categoryId: payload.targetCategoryId })
}
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

.tabs-page__greeting {
  text-align: center;
}

.tabs-page__hello {
  margin: 0 0 0.375rem;
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
}

.tabs-page__date {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
}

.tabs-page__panel {
  width: 100%;
  padding: 0.5rem 0;
}
.tabs-page__compact-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 48rem;
  label {
    cursor: var(--interaction-cursor, pointer);
    font-size: 0.875rem;
    color: var(--text-soft);
  }
  select {
    flex: 1;
    min-width: 9rem;
    max-width: 100%;
  }
  select,
  button {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: $radius-md;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  @media (min-width: 1025px) {
    display: none;
  }
}
.tabs-page__storage-note {
  color: var(--text-soft);
  font-size: 0.8125rem;
}

/* ---- 右下角游客提示浮窗 ---- */
.tabs-guest-toast {
  position: fixed;
  bottom: calc(5rem + env(safe-area-inset-bottom));
  right: 1.5rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.75rem;
  max-width: calc(100vw - 2rem);
  @media (min-width: $breakpoint-lg) {
    bottom: 0.75rem;
  }
}
// Nexus 底栏（72px 高、距底 16px）在常见桌面宽度下铺满右侧，提示改到底栏上方，避免压住导航项
// 提示经 Teleport 挂到 body，主题标记取 html 上的 data-theme
:root[data-theme='nexus'] .tabs-guest-toast {
  @media (min-width: $breakpoint-lg) {
    bottom: calc(72px + 16px + 0.75rem);
  }
}

.tabs-guest-toast__icon {
  flex-shrink: 0;
  color: var(--accent-text);
}

.tabs-guest-toast__text {
  color: var(--text-soft);
  overflow-wrap: anywhere;
}

.tabs-guest-toast__login {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  white-space: nowrap;
  transition: opacity 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.85;
  }
}

.tabs-guest-toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.125rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

.tabs-guest-toast-enter-active,
.tabs-guest-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tabs-guest-toast-enter-from,
.tabs-guest-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
