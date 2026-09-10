/**
 * @file usePageScrollRestoration.ts
 * @description 按浏览器历史项保存主内容滚动位置，兼容主题重挂与异步内容恢复
 * @author TixXin
 * @since 2026-09-07
 */
export function usePageScrollRestoration(
  viewport: Ref<HTMLElement | null>,
  enabled: () => boolean,
  preservedQueryKeys: () => string[] = () => [],
) {
  const router = useRouter()
  const app = useNuxtApp()
  const positions = useState<Record<string, number>>('page-scroll-positions', () => ({}))
  let key = ''
  let path = ''
  let position = 0
  let target: number | undefined
  let targetHash = ''
  let frame = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  let cleanup = () => {}
  function readTop() {
    return resolveScrollRoot(viewport.value)?.scrollTop ?? window.scrollY
  }
  function save() {
    if (!key || target !== undefined || targetHash) return
    positions.value[key] = readTop()
    if (Object.keys(positions.value).length > 100)
      positions.value = Object.fromEntries(Object.entries(positions.value).slice(-100))
  }
  function cancel() {
    target = undefined
    targetHash = ''
    if (timeout) clearTimeout(timeout)
  }
  function restore() {
    if (!viewport.value) return
    if (targetHash) {
      const element = document.getElementById(targetHash)
      if (element && viewport.value.contains(element)) scrollArticleHeading(element)
      return
    }
    if (target === undefined) return
    const root = resolveScrollRoot(viewport.value)
    if (root) root.scrollTo({ top: target, behavior: 'instant' })
    else window.scrollTo({ top: target, behavior: 'instant' })
  }
  function schedule() {
    if (target === undefined && !targetHash) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(restore)
    })
  }
  function begin(top: number | undefined) {
    cancel()
    target = top
    if (top === undefined) return
    // 异步列表或图片尺寸变化时继续恢复；任何用户操作都会立即结束自动恢复。
    timeout = setTimeout(cancel, 2000)
    schedule()
  }
  onMounted(() => {
    if (!enabled()) return
    path = router.currentRoute.value.path
    position = Number(window.history.state?.position ?? 0)
    key = `${router.currentRoute.value.fullPath}@${position}`
    begin(positions.value[key])
    if (
      positions.value[key] === undefined &&
      router.currentRoute.value.hash &&
      viewport.value?.classList.contains('article-viewport')
    ) {
      try {
        targetHash = decodeURIComponent(router.currentRoute.value.hash.slice(1))
      } catch {
        targetHash = ''
      }
      if (targetHash) {
        timeout = setTimeout(cancel, 2000)
        schedule()
      }
    }
    const removeBefore = router.beforeEach(() => {
      save()
    })
    const removeAfter = router.afterEach((to, from, failure) => {
      if (failure || to.path !== path || from.path !== path) return
      const nextPosition = Number(window.history.state?.position ?? 0)
      const replaced = nextPosition === position
      position = nextPosition
      key = `${to.fullPath}@${position}`
      if (replaced) {
        cancel()
        save()
      } else {
        // 灯箱定位等覆盖层状态改变不移动背景列表；真正的筛选与分页仍沿用历史项恢复。
        const ignored = preservedQueryKeys()
        const businessQuery = (query: typeof to.query) =>
          JSON.stringify(
            Object.entries(query)
              .filter(([name]) => !ignored.includes(name))
              .sort(([a], [b]) => a.localeCompare(b)),
          )
        const preserve =
          ignored.length > 0 && to.hash === from.hash && businessQuery(to.query) === businessQuery(from.query)
        begin(positions.value[key] ?? (preserve ? readTop() : 0))
      }
    })
    const removeFinish = app.hook('page:finish', schedule)
    const removeTransition = app.hook('page:transition:finish', schedule)
    const observer = new MutationObserver(schedule)
    if (viewport.value) observer.observe(viewport.value, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    if (viewport.value) resize.observe(viewport.value)
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      document.addEventListener(event, cancel, { capture: true, passive: true })
    cleanup = () => {
      save()
      cancel()
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      removeBefore()
      removeAfter()
      removeFinish()
      removeTransition()
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
        document.removeEventListener(event, cancel, true)
    }
  })
  onBeforeUnmount(() => cleanup())
}
