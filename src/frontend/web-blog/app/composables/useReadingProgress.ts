/**
 * @file useReadingProgress.ts
 * @description 阅读进度追踪组合式函数
 * @author TixXin
 * @since 2025-03-17
 */

import type { Ref } from 'vue'

function computeProgress(scrollTop: number, scrollable: number): number {
  if (scrollable <= 0) return scrollTop > 0 ? 100 : 0
  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)))
}

/**
 * @param scrollRoot 可选：主栏内部滚动容器；不传则使用 document 滚动（视口高度与文档高度）
 */
export function useReadingProgress(scrollRoot?: Ref<HTMLElement | null | undefined>) {
  const progress = ref(0)

  function update() {
    const root = scrollRoot?.value ?? null
    if (root) {
      const max = root.scrollHeight - root.clientHeight
      progress.value = computeProgress(root.scrollTop, max)
      return
    }
    const doc = document.documentElement
    const body = document.body
    const scrollTop = window.scrollY ?? doc.scrollTop ?? body.scrollTop
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    const clientHeight = doc.clientHeight || window.innerHeight
    const max = scrollHeight - clientHeight
    progress.value = computeProgress(scrollTop, max)
  }

  function onScroll() {
    update()
  }

  let attachedRoot: HTMLElement | null = null

  onMounted(() => {
    update()
    attachedRoot = scrollRoot?.value ?? null
    if (attachedRoot) {
      // 使用内部滚动容器时，仅监听该容器的 scroll 事件
      attachedRoot.addEventListener('scroll', onScroll, { passive: true })
    }
    else {
      // 无自定义滚动根时，回退到 window/document 滚动
      window.addEventListener('scroll', onScroll, { passive: true })
    }
    window.addEventListener('resize', onScroll, { passive: true })
  })

  onUnmounted(() => {
    if (attachedRoot) {
      attachedRoot.removeEventListener('scroll', onScroll)
      attachedRoot = null
    }
    else {
      window.removeEventListener('scroll', onScroll)
    }
    window.removeEventListener('resize', onScroll)
  })

  return { progress }
}
