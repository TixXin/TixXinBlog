/**
 * @file useReadingProgress.ts
 * @description 按正文计算阅读进度，按文章编号保存位置并由读者主动恢复
 * @author TixXin
 * @since 2025-03-17
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { articleScrollOffset, resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'

interface ReadingPosition {
  id: string
  position: number
  updatedAt: number
}

const STORAGE_KEY = 'blog-reading-positions'
const MAX_ITEMS = 50
const SAVE_DELAY = 300

function loadPositions(): ReadingPosition[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    const positions = data
      .filter(
        (item): item is ReadingPosition =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          item.id.length > 0 &&
          typeof item.position === 'number' &&
          Number.isFinite(item.position) &&
          item.position > 0 &&
          item.position < 1 &&
          typeof item.updatedAt === 'number' &&
          Number.isFinite(item.updatedAt) &&
          item.updatedAt >= 0,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
    const seen = new Set<string>()
    return positions
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      .slice(0, MAX_ITEMS)
  } catch {
    // 阅读位置是可选便利功能，禁用存储或损坏记录不应中断正文阅读。
    return []
  }
}

function savePosition(id: string, position: number | null) {
  try {
    // 每次写入合并最新列表，避免其他文章或标签页的记录被旧快照覆盖。
    const items = loadPositions().filter((item) => item.id !== id)
    if (position !== null) items.unshift({ id, position, updatedAt: Date.now() })
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 配额不足或隐私模式下继续提供阅读和当前会话内的跳转。
  }
}

export function useReadingProgress(
  scrollRoot: Ref<HTMLElement | null | undefined>,
  content: Ref<HTMLElement | null>,
  articleId: MaybeRefOrGetter<string>,
) {
  const progress = ref(0)
  const savedPosition = ref<number | null>(null)
  const resumeProgress = computed(() =>
    savedPosition.value === null ? null : Math.max(1, Math.min(99, Math.round(savedPosition.value * 100))),
  )
  let id = ''
  let mounted = false
  let completed = false
  let enteredContent = false
  let frame = 0
  let scrolled = false
  let scrollSample: ReturnType<typeof geometry> = null
  let pending: { id: string; position: number } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let observer: ResizeObserver | null = null
  let cancelScroll: (() => void) | undefined

  function geometry() {
    const element = content.value
    if (!element) return null
    const root = resolveScrollRoot(scrollRoot.value ?? element.parentElement)
    const bounds = element.getBoundingClientRect()
    const rootBounds = root?.getBoundingClientRect()
    const top = (rootBounds?.top ?? 0) + articleScrollOffset(element)
    const bottom = rootBounds?.bottom ?? window.innerHeight
    if (bounds.height <= 0 || bottom <= top) return null
    return { element, root, bounds, top, bottom, range: bounds.height - (bottom - top) }
  }

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!pending) return
    savePosition(pending.id, pending.position)
    pending = null
  }

  function clearPosition() {
    savedPosition.value = null
    pending = null
    clearTimeout(timer)
    timer = undefined
    savePosition(id, null)
  }

  function update() {
    frame = 0
    const shouldSave = scrolled
    scrolled = false
    // 卸载时主题容器可能已脱离布局；使用滚动事件发生时的正文几何信息。
    const value = shouldSave ? scrollSample : geometry()
    scrollSample = null
    if (!value) return
    const { bounds, top, bottom, range } = value
    // 懒加载图片尚未撑开正文时不能提前清除记录。
    const atEnd =
      bounds.bottom <= bottom + 1 && !Array.from(value.element.querySelectorAll('img')).some((image) => !image.complete)
    const position = range > 0 ? Math.max(0, Math.min(1, (top - bounds.top) / range)) : 0
    // 只有正文末尾实际进入视口才算读完，不能将四舍五入的 100% 当作完成。
    progress.value = atEnd ? 100 : Math.min(99, Math.round(position * 100))
    if (!id || completed) return
    if (atEnd) {
      completed = true
      clearPosition()
    } else if (shouldSave && position === 0 && enteredContent) {
      enteredContent = false
      clearPosition()
    } else if (shouldSave && position > 0) {
      enteredContent = true
      // 未加载图片可能继续扩展正文，未完成的位置始终保持在可恢复区间。
      pending = { id, position: Math.min(position, 0.999999) }
      // 连续滚动时定期落盘；离开页面和切到后台时再同步最后一笔。
      timer ??= setTimeout(flush, SAVE_DELAY)
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  function onScroll(event: Event) {
    const element = content.value
    if (!element) return
    const root = resolveScrollRoot(scrollRoot.value ?? element.parentElement)
    if (event.target !== (root ?? document)) return
    scrolled = true
    scrollSample = geometry()
    schedule()
  }

  function saveBeforeLeaving() {
    if (scrolled) {
      cancelAnimationFrame(frame)
      update()
    }
    flush()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') saveBeforeLeaving()
  }

  function onImageSettled(event: Event) {
    if (event.target instanceof HTMLImageElement && content.value?.contains(event.target)) schedule()
  }

  async function resumeReading() {
    const position = savedPosition.value
    const owner = id
    if (position === null || !geometry()) return
    savedPosition.value = null
    // 提示收起会改变正文起点，必须等待 DOM 更新后再按当前主题和视口换算。
    await nextTick()
    if (!mounted || id !== owner) return
    const value = geometry()
    if (!value) return
    const { element, root, bounds, top, range } = value
    const offset = Math.max(0, range) * position
    const target = Math.max(0, (root?.scrollTop ?? window.scrollY) + bounds.top - top + offset)
    cancelScroll?.()
    cancelScroll = scrollToRoot(root, target)
    // 焦点跟随恢复位置，读屏与键盘阅读不留在已经消失的顶部按钮上。
    const blocks = Array.from(
      element.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, pre, table, blockquote'),
    )
    const focusTarget = blocks.findLast((block) => block.getBoundingClientRect().top <= bounds.top + offset) ?? element
    focusTarget.setAttribute('tabindex', '-1')
    focusTarget.focus({ preventScroll: true })
  }

  onMounted(() => {
    mounted = true
    watch(
      () => toValue(articleId),
      (nextId) => {
        saveBeforeLeaving()
        cancelScroll?.()
        id = nextId
        completed = false
        enteredContent = false
        progress.value = 0
        savedPosition.value = loadPositions().find((item) => item.id === id)?.position ?? null
        schedule()
      },
      { immediate: true },
    )
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    // 图片已有占位尺寸时，加载或失败不会触发 ResizeObserver，仍需重新判断完成。
    document.addEventListener('load', onImageSettled, true)
    document.addEventListener('error', onImageSettled, true)
    window.addEventListener('pagehide', saveBeforeLeaving)
    window.addEventListener('resize', schedule, { passive: true })
    observer = new ResizeObserver(schedule)
    watch(
      [content, scrollRoot],
      () => {
        observer?.disconnect()
        if (content.value) observer?.observe(content.value)
        if (scrollRoot.value) observer?.observe(scrollRoot.value)
        schedule()
      },
      { immediate: true, flush: 'post' },
    )
  })

  onBeforeUnmount(() => {
    mounted = false
    saveBeforeLeaving()
    cancelScroll?.()
    cancelAnimationFrame(frame)
    observer?.disconnect()
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    document.removeEventListener('load', onImageSettled, true)
    document.removeEventListener('error', onImageSettled, true)
    window.removeEventListener('pagehide', saveBeforeLeaving)
    window.removeEventListener('resize', schedule)
  })

  return { progress, resumeProgress, resumeReading }
}
