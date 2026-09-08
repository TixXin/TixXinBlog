/**
 * @file usePageMotion.ts
 * @description 标题与正文独立过渡；导航共享事务，快照仅属于正文且不阻挡交互
 */
import { getPageMotionRegions } from '~/utils/pageMotionRegions'

export function usePageMotion(host: Ref<HTMLElement | null>) {
  const app = useNuxtApp()
  const router = useRouter()
  const { contentTransitionName, contentTransitionDuration } = useAppearanceSettings()
  const { reducedMotion } = useMotionPreference()
  const pending = ref(false)
  const active = useState<false | { name: string; duration: number }>('page-transition-current', () => false)
  const completed = useState('page-motion-completed', () => 0)
  let version = 0
  let settledVersion = 0
  let destination = ''
  let previousRoot: HTMLElement | null = null
  let previousHeaderKey = ''
  let focusKey: string | undefined
  let ghost: HTMLElement | null = null
  let overlay: HTMLElement | null = null
  let scrollPositions: { node: HTMLElement; top: number; left: number }[] = []
  let animations: Animation[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const disposers: (() => void)[] = []
  const root = () =>
    [...(host.value?.children ?? [])].find(
      (node) => !node.hasAttribute('data-page-motion-status') && !node.hasAttribute('data-page-motion-overlay'),
    ) as HTMLElement | undefined

  function clean() {
    if (timer) clearTimeout(timer)
    timer = undefined
    animations.forEach((animation) => animation.cancel())
    animations = []
    overlay?.remove()
    overlay = null
    ghost = null
    scrollPositions = []
  }
  function finish() {
    clean()
    pending.value = false
    if (settledVersion !== version) {
      settledVersion = version
      completed.value++
    }
  }
  function captureBody(element: HTMLElement) {
    const body = getPageMotionRegions(element).body
    ghost = body.cloneNode(true) as HTMLElement
    const originalNodes = [body, ...body.querySelectorAll<HTMLElement>('*')]
    const clonedNodes = [ghost, ...ghost.querySelectorAll<HTMLElement>('*')]
    scrollPositions = originalNodes.flatMap((node, index) =>
      node.scrollTop || node.scrollLeft
        ? [{ node: clonedNodes[index]!, top: node.scrollTop, left: node.scrollLeft }]
        : [],
    )
    ghost.querySelectorAll('[data-page-motion-status],[data-page-motion-overlay]').forEach((node) => node.remove())
    for (const node of clonedNodes) {
      node.removeAttribute('id')
      node.removeAttribute('data-focus-key')
    }
    const bounds = body.getBoundingClientRect()
    ghost.setAttribute('data-page-motion-clone', '')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.inert = true
    Object.assign(ghost.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      margin: '0',
      pointerEvents: 'none',
    })
  }
  function play(element: HTMLElement, frames: Keyframe[], duration: number, easing: string, remove = false) {
    const animation = element.animate(frames, { duration, easing, fill: 'both' })
    animations.push(animation)
    // 各区域按自己的时长清理，正文不等待标题，短标题也不会保留finished填充层。
    const settled = animation.finished.then(
      () => {
        if (remove) element.remove()
        animation.cancel()
      },
      () => {},
    )
    return settled
  }
  function restoreHeaderFocus(element: HTMLElement) {
    const regions = getPageMotionRegions(element)
    if (!focusKey || regions.headerKey !== previousHeaderKey || document.activeElement !== document.body) return
    const target = [...(regions.header?.querySelectorAll<HTMLElement>('[data-focus-key]') ?? [])].find(
      (node) => node.dataset.focusKey === focusKey,
    )
    target?.focus({ preventScroll: true })
  }
  onMounted(() => {
    const forgetFocus = () => {
      focusKey = undefined
    }
    document.addEventListener('pointerdown', forgetFocus, true)
    document.addEventListener('keydown', forgetFocus, true)
    disposers.push(() => {
      document.removeEventListener('pointerdown', forgetFocus, true)
      document.removeEventListener('keydown', forgetFocus, true)
    })
    disposers.push(
      router.beforeEach((to, from) => {
        // 同页参数更新归属分页/筛选组件；也不能让旧跨页任务挂在新的目标URL上。
        if (to.path === from.path) {
          if (pending.value) {
            destination = to.fullPath
          } else if (animations.length) finish()
          return
        }
        version++
        clean()
        destination = to.fullPath
        previousRoot = root() ?? null
        const previous = previousRoot && getPageMotionRegions(previousRoot)
        previousHeaderKey = previous?.headerKey ?? ''
        const focused = document.activeElement
        focusKey =
          focused instanceof HTMLElement && previous?.header?.contains(focused) && focused.matches(':focus-visible')
            ? focused.dataset.focusKey
            : undefined
        const duration = reducedMotion.value ? 0 : contentTransitionDuration.value
        active.value = duration ? { name: contentTransitionName.value, duration } : false
        pending.value = true
        if (duration && previousRoot) captureBody(previousRoot)
      }),
    )
    disposers.push(
      router.afterEach((to, _from, failure) => {
        if (failure && to.fullPath === destination && router.currentRoute.value.fullPath !== destination) finish()
      }),
    )
    disposers.push(
      router.onError((_error, to) => {
        if (to.fullPath === destination) finish()
      }),
    )
    disposers.push(
      app.hook('page:finish', async () => {
        await nextTick()
        if (!pending.value || destination !== router.currentRoute.value.fullPath) return
        const element = root()
        if (!element || element === previousRoot) return
        const transaction = version
        const regions = getPageMotionRegions(element)
        pending.value = false
        restoreHeaderFocus(element)
        if (!active.value || reducedMotion.value || typeof regions.body.animate !== 'function') {
          finish()
          return
        }
        const { name, duration } = active.value
        const distance = name === 'content-fade' ? 0 : name === 'content-soft' ? 6 : 8
        try {
          const tasks: Promise<void>[] = []
          if (regions.header && regions.headerKey !== previousHeaderKey) {
            tasks.push(play(regions.header, [{ opacity: 0 }, { opacity: 1 }], 120, 'ease-out'))
          }
          tasks.push(
            play(
              regions.body,
              [
                { opacity: 0, transform: `translateY(-${distance}px)` },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              duration,
              'ease-out',
            ),
          )
          if (ghost && previousRoot && host.value) {
            // 新正文的边界决定快照裁切范围，标题变高时旧快照也不能盖住标题。
            const frame = regions.frame.getBoundingClientRect(),
              parent = host.value.getBoundingClientRect()
            overlay = previousRoot.cloneNode(false) as HTMLElement
            overlay.removeAttribute('id')
            overlay.removeAttribute('data-page-frame')
            overlay.setAttribute('data-page-motion-overlay', '')
            overlay.setAttribute('aria-hidden', 'true')
            overlay.inert = true
            Object.assign(overlay.style, {
              position: 'absolute',
              left: `${frame.left - parent.left}px`,
              top: `${frame.top - parent.top}px`,
              width: `${frame.width}px`,
              height: `${frame.height}px`,
              margin: '0',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: '2',
              contain: 'layout paint',
            })
            overlay.appendChild(ghost)
            host.value.appendChild(overlay)
            for (const position of scrollPositions) {
              position.node.scrollTop = position.top
              position.node.scrollLeft = position.left
            }
            tasks.push(
              play(
                ghost,
                [
                  { opacity: 1, transform: 'translateY(0)' },
                  { opacity: 0, transform: `translateY(${distance}px)` },
                ],
                duration,
                'ease-in',
                true,
              ),
            )
          }
          void Promise.all(tasks).then(() => {
            if (transaction === version) finish()
          })
          timer = setTimeout(
            () => {
              if (transaction === version) finish()
            },
            Math.max(duration, 120) + 80,
          )
        } catch {
          // 动效API不可用时立即保留已提交内容，错误边界仍负责真实页面/业务错误。
          if (transaction === version) finish()
        }
      }),
    )
  })
  watch(
    [reducedMotion, contentTransitionDuration],
    ([reduced, duration]) => {
      if (reduced || duration === 0) {
        active.value = false
        if (animations.length) finish()
        else clean()
      }
    },
    { flush: 'sync' },
  )
  watch(host, (next, previous) => {
    if (previous && next !== previous) {
      version++
      finish()
      previousRoot = null
    }
  })
  onBeforeUnmount(() => {
    version++
    clean()
    disposers.forEach((dispose) => dispose())
  })
  return { pending }
}
