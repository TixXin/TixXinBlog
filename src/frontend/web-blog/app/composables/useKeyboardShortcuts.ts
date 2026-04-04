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

  function handleKeydown(e: KeyboardEvent) {
    // 忽略在输入框内的按键
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return
    }

    // Ctrl/Cmd + K: 唤起搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      info('全局搜索功能开发中...')
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
      // [ / ]: 上下篇 (这里只是占位，实际需要获取上下篇的 ID)
      else if (e.key === '[') {
        info('上一篇功能开发中...')
      } else if (e.key === ']') {
        info('下一篇功能开发中...')
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
