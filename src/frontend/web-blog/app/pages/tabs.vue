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
      <div v-if="tabSettings.showGreeting || tabSettings.showDate" class="tabs-page__greeting">
        <h1 v-if="tabSettings.showGreeting" class="tabs-page__hello">{{ greetingLine }}</h1>
        <p v-if="tabSettings.showDate" class="tabs-page__date">{{ today }}</p>
      </div>

      <TabSearchBar />

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
      @close="ctxVisible = false"
    />
    <TabAddCategoryDialog
      v-model:visible="addCategoryVisible"
      @submit="onSubmitCategory"
    />
    <TabSettingsDrawer
      v-model:visible="settingsOpen"
      :user="displayUser"
      @open-import="importOpen = true"
    />

    <TabImportDialog v-model:visible="importOpen" />

    <TabCommandPalette :actions="paletteActions" />

    <!-- 游客提示：Teleport 到 body，避免祖先 transform 破坏 fixed 定位 -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="tabs-guest-toast">
          <div v-if="isReadOnly && !guestToastDismissed" class="tabs-guest-toast">
            <Icon name="lucide:info" size="14" class="tabs-guest-toast__icon" />
            <span class="tabs-guest-toast__text">正在浏览博主的标签页</span>
            <button type="button" class="tabs-guest-toast__login" @click="onLogin">
              登录
              <Icon name="lucide:log-in" size="11" />
            </button>
            <button type="button" class="tabs-guest-toast__close" aria-label="关闭" @click="guestToastDismissed = true">
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

useSeoMeta({
  title: '标签页',
  description: '你的个人起始页：搜索 + 书签 + 分类管理',
})

const { currentUser, isLoggedIn } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const {
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

const { success, info } = useToast()
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
    title: `切换视图：${viewLabel(mode)}`,
    subtitle: tabSettings.value.viewMode === mode ? '当前视图' : '',
    icon: viewIcon(mode),
    section: 'actions',
    run: () => updateSetting('viewMode', mode),
  })
  return [
    {
      id: 'add-bookmark',
      title: '新建书签',
      subtitle: '打开书签编辑对话框',
      icon: 'lucide:plus',
      shortcut: 'N',
      section: 'actions',
      run: () => onAddBookmarkClick(),
    },
    {
      id: 'add-category',
      title: '新建分类',
      icon: 'lucide:folder-plus',
      section: 'actions',
      run: () => (addCategoryVisible.value = true),
    },
    switchView('grid'),
    switchView('compact'),
    switchView('list'),
    switchView('cards'),
    {
      id: 'open-settings',
      title: '打开设置',
      icon: 'lucide:settings',
      section: 'actions',
      run: () => (settingsOpen.value = true),
    },
    {
      id: 'toggle-drag',
      title: tabSettings.value.dragEnabled ? '关闭拖拽排序' : '开启拖拽排序',
      icon: 'lucide:move',
      section: 'actions',
      run: () => updateSetting('dragEnabled', !tabSettings.value.dragEnabled),
    },
    {
      id: 'import',
      title: '导入书签',
      subtitle: 'JSON 或浏览器 HTML',
      icon: 'lucide:upload',
      section: 'actions',
      run: () => (importOpen.value = true),
    },
  ]
})

function viewLabel(mode: TabViewMode): string {
  switch (mode) {
    case 'grid':
      return '网格'
    case 'compact':
      return '紧凑'
    case 'list':
      return '列表'
    case 'cards':
      return '卡片'
  }
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
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

const greetingLine = computed(() => {
  if (!isLoggedIn.value) return `欢迎来到 ${mockOwnerUser.nickname} 的标签页`
  return `${greeting.value}，${currentUser.value?.nickname ?? ''}`
})

const today = computed(() => {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  let str = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`
  if (tabSettings.value.showSeconds) {
    str += ` · ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }
  return str
})

// 设置中的默认折叠变化时同步侧边栏
watch(() => tabSettings.value.defaultCollapsed, (v) => {
  sidebarCollapsed.value = v
})

onMounted(() => {
  void load()
})

watch(isLoggedIn, () => {
  void load(true)
})

function onLogin() {
  openLoginDrawer('login')
}

function onAddBookmarkClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  addBookmarkVisible.value = true
}

async function onSubmitBookmark(draft: BookmarkDraft) {
  await addBookmark(draft)
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
  if (!window.confirm('确认删除该分类？该分类下的书签也会一并删除。')) return
  await removeCategory(id)
}

async function onReorder(updates: BookmarkReorderUpdate[]) {
  await reorderBookmarks(updates)
}

async function onUpdateBookmarkFromDialog(payload: { id: string; patch: BookmarkDraft }) {
  await updateBookmark(payload.id, payload.patch)
}

// ---- 上下文菜单 ----
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxItems = ref<ContextMenuItem[]>([])
const editingBookmark = ref<Bookmark | null>(null)

const copyToClipboard = async (text: string, msg = 'URL 已复制') => {
  try {
    await navigator.clipboard.writeText(text)
    success(msg)
  } catch {
    // clipboard 可能被禁用（非 HTTPS / 禁用）
  }
}

function onBookmarkContextMenu(payload: { bookmark: Bookmark; x: number; y: number }) {
  const bm = payload.bookmark
  ctxX.value = payload.x
  ctxY.value = payload.y

  // 只读模式：仅保留查看类动作，修改类动作引导登录
  if (isReadOnly.value) {
    ctxItems.value = [
      {
        label: '打开（新标签）',
        icon: 'lucide:external-link',
        run: () => window.open(bm.url, '_blank', 'noopener'),
      },
      {
        label: '复制 URL',
        icon: 'lucide:clipboard',
        run: () => copyToClipboard(bm.url),
      },
      { type: 'divider' },
      {
        label: '登录以编辑',
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
    ctxVisible.value = true
    return
  }

  ctxItems.value = [
    {
      label: '打开（新标签）',
      icon: 'lucide:external-link',
      run: () => window.open(bm.url, '_blank', 'noopener'),
    },
    {
      label: '编辑',
      icon: 'lucide:edit-3',
      run: () => {
        editingBookmark.value = bm
        addBookmarkVisible.value = true
      },
    },
    {
      label: '复制 URL',
      icon: 'lucide:clipboard',
      run: () => copyToClipboard(bm.url),
    },
    {
      label: bm.pinned ? '取消置顶' : '置顶',
      icon: bm.pinned ? 'lucide:pin-off' : 'lucide:pin',
      run: () => updateBookmark(bm.id, { pinned: !bm.pinned }),
    },
    {
      label: '刷新 favicon',
      icon: 'lucide:refresh-cw',
      run: () => refreshFavicon(bm.id),
    },
    {
      label: '移至分类',
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
      label: '删除',
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
  ctxX.value = payload.x
  ctxY.value = payload.y

  if (isReadOnly.value) {
    ctxItems.value = [
      {
        label: '查看该分类',
        icon: 'lucide:eye',
        run: () => selectCategory(cat.id),
      },
      { type: 'divider' },
      {
        label: '登录以编辑分类',
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
    ctxVisible.value = true
    return
  }

  ctxItems.value = [
    {
      label: '打开该分类',
      icon: 'lucide:eye',
      run: () => selectCategory(cat.id),
    },
    {
      label: '重命名',
      icon: 'lucide:edit-3',
      run: async () => {
        const next = window.prompt('新分类名称', cat.name)?.trim()
        if (next && next !== cat.name) {
          await updateCategoryMeta(cat.id, { name: next })
        }
      },
    },
    {
      label: '更改图标',
      icon: 'lucide:shapes',
      run: async () => {
        const next = window.prompt('Lucide 图标名（如 lucide:folder）', cat.icon || '')?.trim()
        if (next) await updateCategoryMeta(cat.id, { icon: next })
      },
    },
    { type: 'divider' },
    {
      label: '删除分类',
      icon: 'lucide:trash-2',
      danger: true,
      run: () => onRemoveCategory(cat.id),
    },
  ]
  ctxVisible.value = true
}

/** 空白区右键菜单（未登录时也可用，以只读动作为主） */
function onBlankContextMenu(e: MouseEvent) {
  ctxX.value = e.clientX
  ctxY.value = e.clientY

  const common: ContextMenuItem[] = [
    {
      label: '打开命令面板',
      icon: 'lucide:command',
      shortcut: 'Ctrl+K',
      run: () => tabPalette.open(),
    },
    {
      label: '打开设置',
      icon: 'lucide:settings',
      run: () => (settingsOpen.value = true),
    },
    {
      label: '切换视图',
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
        label: '登录以新建书签',
        icon: 'lucide:log-in',
        run: () => openLoginDrawer('login'),
      },
    ]
  } else {
    ctxItems.value = [
      {
        label: '新建书签',
        icon: 'lucide:plus',
        run: () => onAddBookmarkClick(),
      },
      {
        label: '新建分类',
        icon: 'lucide:folder-plus',
        run: () => (addCategoryVisible.value = true),
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
  info('浏览模式下无法修改，请先登录')
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

/* ---- 右下角游客提示浮窗 ---- */
.tabs-guest-toast {
  position: fixed;
  bottom: 0.75rem;
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
}

.tabs-guest-toast__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.tabs-guest-toast__text {
  color: var(--text-soft);
  white-space: nowrap;
}

.tabs-guest-toast__login {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: var(--accent);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.18s;

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
  cursor: pointer;

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
}

.tabs-guest-toast-enter-from,
.tabs-guest-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

</style>
