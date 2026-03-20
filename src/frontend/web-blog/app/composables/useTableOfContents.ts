/**
 * @file useTableOfContents.ts
 * @description 文章目录观察与高亮组合式函数
 * @author TixXin
 * @since 2025-03-17
 */

import type { TocItem } from '~/features/post/types'

/**
 * 根据正文标题锚点在视口中的位置高亮当前目录项
 */
export function useTableOfContents(items: MaybeRefOrGetter<TocItem[]>) {
  const activeId = ref('')

  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const list = toValue(items)
    if (!list.length) return

    nextTick(() => {
      const seen = new Map<string, IntersectionObserverEntry>()

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.id
            if (!id) continue
            if (entry.isIntersecting) {
              seen.set(id, entry)
            } else {
              seen.delete(id)
            }
          }

          if (seen.size === 0) {
            return
          }

          let bestId = ''
          let bestTop = Number.POSITIVE_INFINITY
          for (const [id, entry] of seen) {
            const top = entry.boundingClientRect.top
            if (top >= 0 && top < bestTop) {
              bestTop = top
              bestId = id
            }
          }
          if (!bestId) {
            const first = [...seen.keys()][0]
            bestId = first ?? ''
          }
          if (bestId) {
            activeId.value = bestId
          }
        },
        {
          root: null,
          rootMargin: '-15% 0px -55% 0px',
          threshold: [0, 0.1, 0.5, 1],
        },
      )

      for (const item of list) {
        const el = document.getElementById(item.id)
        if (el) {
          observer?.observe(el)
        }
      }

      const first = list[0]
      if (first) {
        activeId.value = first.id
      }
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { activeId }
}
