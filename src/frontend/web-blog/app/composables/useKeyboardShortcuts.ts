/**
 * @file useKeyboardShortcuts.ts
 * @description 全局键盘快捷键管理
 * @author TixXin
 * @since 2026-04-04
 */

import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'

export function useKeyboardShortcuts(search?: { open: () => void }) {
  const route = useRoute()
  const { isDrawerOpen, closeDrawer } = useAppearanceSettings()
  const { info } = useToast()
  const searchModal = search ?? inject<{ open: () => void } | null>('searchModal', null)

  const tabPalette = useTabCommandPalette()
  const { settings: tabSettings } = useTabSettings()
  const isShortcutHelpOpen = ref(false)

  // 页面切换后释放帮助层及其焦点约束，后台不继承公开站点的帮助状态。
  watch(
    () => route.path,
    () => (isShortcutHelpOpen.value = false),
  )

  async function handleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.isComposing || e.getModifierState('AltGraph') || isShortcutHelpOpen.value) return
    // Ctrl/Cmd + K: 唤起搜索（优先响应，不受输入框限制）
    // 在 /tabs 路由下切换到标签页命令面板，其它路由走通用 searchModal
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      if (route.path === '/tabs' && tabSettings.value.commandPaletteEnabled) {
        tabPalette.open()
      } else {
        searchModal?.open()
      }
      return
    }

    // 编辑区域的后代节点也属于输入目标；选择框与自定义输入组件同样保留原有键盘行为。
    const target = e.target instanceof HTMLElement ? e.target : null
    if (
      target?.isContentEditable ||
      target?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
      )
    ) {
      return
    }

    // 允许 Shift+/ 产生的问号，但不抢占组合键、后台或已有模态层的交互。
    if (e.key === '?') {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat ||
        route.path === '/admin' ||
        route.path.startsWith('/admin/') ||
        isDrawerOpen.value ||
        document.querySelector('[aria-modal="true"], dialog[open]')
      ) {
        return
      }
      e.preventDefault()
      isShortcutHelpOpen.value = true
      return
    }

    // Escape: 关闭抽屉/弹层
    if (e.key === 'Escape') {
      if (isDrawerOpen.value) {
        closeDrawer()
        e.preventDefault()
        return
      }
      // LightBox 等组件内部已处理 Escape，这里作为兜底
    }

    // 文章详情页特定快捷键
    if (route.name === 'articles-id') {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const root = resolveScrollRoot(document.querySelector<HTMLElement>('.article-reading-content'))
      const position = root?.scrollTop ?? window.scrollY
      // j: 向下滚动
      if (e.key === 'j') {
        scrollToRoot(root, position + 100)
        e.preventDefault()
      }
      // k: 向上滚动
      else if (e.key === 'k') {
        scrollToRoot(root, position - 100)
        e.preventDefault()
      }
      // t: 回到顶部
      else if (e.key === 't') {
        scrollToRoot(root, 0)
        e.preventDefault()
      }
      // [ / ]: 上下篇导航
      else if (e.key === '[' || e.key === ']') {
        const currentId = route.params.id as string
        const { mockPosts } = await import('~/features/post/mock')
        const idx = mockPosts.findIndex((p) => p.id.toString() === currentId)
        if (idx === -1) return
        const targetIdx = e.key === '[' ? idx - 1 : idx + 1
        const target = mockPosts[targetIdx]
        if (target) {
          navigateTo(`/articles/${target.id}`)
        } else {
          info(e.key === '[' ? '已经是第一篇了' : '已经是最后一篇了')
        }
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return { isShortcutHelpOpen }
}
