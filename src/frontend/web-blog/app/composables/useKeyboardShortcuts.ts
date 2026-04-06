/**
 * @file useKeyboardShortcuts.ts
 * @description 全局键盘快捷键管理
 * @author TixXin
 * @since 2026-04-04
 */

export function useKeyboardShortcuts() {
  const route = useRoute()
  const { isDrawerOpen, closeDrawer } = useAppearanceSettings()
  const { info } = useToast()
  const searchModal = inject<{ open: () => void } | null>('searchModal', null)

  async function handleKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd + K: 唤起搜索（优先响应，不受输入框限制）
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      searchModal?.open()
      return
    }

    // 忽略在输入框内的按键
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) {
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
      // j: 向下滚动
      if (e.key === 'j') {
        window.scrollBy({ top: 100, behavior: 'smooth' })
        e.preventDefault()
      }
      // k: 向上滚动
      else if (e.key === 'k') {
        window.scrollBy({ top: -100, behavior: 'smooth' })
        e.preventDefault()
      }
      // t: 回到顶部
      else if (e.key === 't') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
}
