/**
 * @file useTabContextMenu.ts
 * @description 标签页上下文菜单（书签右键、分类右键、空白区右键）状态与动作处理
 * @author TixXin
 * @since 2026-04-11
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { AuthView } from '~/features/auth/types'
import type { ContextMenuItem } from '~/components/tab/TabContextMenu.vue'
import type { TabViewMode } from '~/composables/useTabSettings'
import type { Bookmark, BookmarkCategory } from '~/features/tab/types'
import { getTabViewModeIcon, getTabViewModeLabel } from './viewMode'

export interface UseTabContextMenuOptions {
  categories: Ref<BookmarkCategory[]>
  isReadOnly: Ref<boolean>
  onAddBookmark: () => void
  onAddCategory: () => void
  onEditBookmark: (bookmark: Bookmark) => void
  onOpenSettings: () => void
  onOpenLogin: (view?: AuthView) => void
  onRemoveCategory: (id: string) => Promise<unknown>
  onRemoveBookmark: (id: string) => Promise<unknown>
  onUpdateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'userId'>>) => Promise<Bookmark | null>
  onRefreshFavicon: (id: string) => Promise<unknown>
  onSelectCategory: (id: string | null) => void
}

/**
 * 标签页上下文右键菜单流程
 */
export function useTabContextMenu(options: UseTabContextMenuOptions) {
  const { t } = useI18n()
  const { success } = useToast()
  const tabPalette = useTabCommandPalette()
  const tabRepo = useTabRepository()
  const { update: updateSetting } = useTabSettings()

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

  async function updateCategoryMeta(id: string, patch: Partial<{ name: string; icon: string; color: string }>) {
    const updated = await tabRepo.updateCategory(id, patch)
    const idx = options.categories.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      const next = [...options.categories.value]
      next[idx] = updated
      options.categories.value = next
    }
  }

  function onBookmarkContextMenu(payload: { bookmark: Bookmark; x: number; y: number }) {
    const bm = payload.bookmark
    ctxFocusKey.value = `bookmark:${bm.id}`
    ctxX.value = payload.x
    ctxY.value = payload.y

    // 只读模式：仅保留查看类动作，修改类动作引导登录
    if (options.isReadOnly.value) {
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
          run: () => options.onOpenLogin('login'),
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
          options.onEditBookmark(bm)
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
        run: () => options.onUpdateBookmark(bm.id, { pinned: !bm.pinned }),
      },
      {
        label: t('misc.tab.menu.refreshFavicon'),
        icon: 'lucide:refresh-cw',
        run: () => options.onRefreshFavicon(bm.id),
      },
      {
        label: t('misc.tab.menu.moveTo'),
        icon: 'lucide:folder-symlink',
        submenu: options.categories.value
          .filter((c) => c.id !== bm.categoryId)
          .map((c) => ({
            label: c.name,
            icon: c.icon,
            run: () => options.onUpdateBookmark(bm.id, { categoryId: c.id }),
          })),
      },
      { type: 'divider' },
      {
        label: t('misc.tab.menu.remove'),
        icon: 'lucide:trash-2',
        danger: true,
        run: () => options.onRemoveBookmark(bm.id),
      },
    ]
    ctxVisible.value = true
  }

  function onCategoryContextMenu(payload: { categoryId: string; x: number; y: number }) {
    const cat = options.categories.value.find((c) => c.id === payload.categoryId)
    if (!cat) return
    ctxFocusKey.value = `category:${cat.id}`
    ctxX.value = payload.x
    ctxY.value = payload.y

    if (options.isReadOnly.value) {
      ctxItems.value = [
        {
          label: t('misc.tab.menu.viewCategory'),
          icon: 'lucide:eye',
          run: () => options.onSelectCategory(cat.id),
        },
        { type: 'divider' },
        {
          label: t('misc.tab.menu.loginToEditCategory'),
          icon: 'lucide:log-in',
          run: () => options.onOpenLogin('login'),
        },
      ]
      ctxVisible.value = true
      return
    }

    ctxItems.value = [
      {
        label: t('misc.tab.menu.openCategory'),
        icon: 'lucide:eye',
        run: () => options.onSelectCategory(cat.id),
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
        run: () => options.onRemoveCategory(cat.id),
      },
    ]
    ctxVisible.value = true
  }

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
          options.onOpenSettings()
        },
      },
      {
        label: t('misc.tab.menu.switchView'),
        icon: 'lucide:layout-grid',
        submenu: (['grid', 'compact', 'list', 'cards'] as TabViewMode[]).map((m) => ({
          label: getTabViewModeLabel(m, t),
          icon: getTabViewModeIcon(m),
          run: () => updateSetting('viewMode', m),
        })),
      },
    ]

    if (options.isReadOnly.value) {
      ctxItems.value = [
        ...common,
        { type: 'divider' },
        {
          label: t('misc.tab.menu.loginToAdd'),
          icon: 'lucide:log-in',
          run: () => options.onOpenLogin('login'),
        },
      ]
    } else {
      ctxItems.value = [
        {
          label: t('misc.tab.menu.addBookmark'),
          icon: 'lucide:plus',
          run: () => options.onAddBookmark(),
        },
        {
          label: t('misc.tab.menu.addCategory'),
          icon: 'lucide:folder-plus',
          run: () => {
            options.onAddCategory()
          },
        },
        { type: 'divider' },
        ...common,
      ]
    }
    ctxVisible.value = true
  }

  return {
    ctxVisible,
    ctxX,
    ctxY,
    ctxItems,
    ctxFocusKey,
    editingBookmark,
    onBookmarkContextMenu,
    onCategoryContextMenu,
    onBlankContextMenu,
  }
}
