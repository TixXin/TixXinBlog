/**
 * @file usePageMotion.ts
 * @description 将页面视觉过渡与Nuxt异步路由生命周期分离，导航始终可中断且保留当前实例
 * @author TixXin
 * @since 2026-09-08
 */
export function usePageMotion(host: Ref<HTMLElement | null>) {
  const app = useNuxtApp()
  const router = useRouter()
  const { contentTransitionName, contentTransitionDuration } = useAppearanceSettings()
  const { reducedMotion } = useMotionPreference()
  const pending = ref(false)
  const active = useState<false | { name: string; duration: number }>('page-transition-current', () => false)
  const completed = useState('page-motion-completed', () => 0)
  let version = 0
  let destination = ''
  let previousRoot: HTMLElement | null = null
  let ghost: HTMLElement | null = null
  let scrollPositions: { index: number; top: number; left: number }[] = []
  let animations: Animation[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const disposers: (() => void)[] = []
  const root = () =>
    [...(host.value?.children ?? [])].find(
      (node) => !node.hasAttribute('data-page-motion-status') && !node.hasAttribute('data-page-motion-clone'),
    ) as HTMLElement | undefined
  function clean() {
    if (timer) clearTimeout(timer)
    animations.forEach((animation) => animation.cancel())
    animations = []
    ghost?.remove()
    ghost = null
    scrollPositions = []
  }
  function finish() {
    clean()
    pending.value = false
    completed.value++
  }
  onMounted(() => {
    disposers.push(
      router.beforeEach((to, from) => {
        if (to.path === from.path) return
        version++
        clean()
        destination = to.fullPath
        previousRoot = root() ?? null
        const duration = reducedMotion.value ? 0 : contentTransitionDuration.value
        active.value = duration ? { name: contentTransitionName.value, duration } : false
        pending.value = true
        if (!duration || !previousRoot) return
        ghost = previousRoot.cloneNode(true) as HTMLElement
        ghost.setAttribute('data-page-motion-clone', '')
        ghost.setAttribute('aria-hidden', 'true')
        ghost.inert = true
        ghost.removeAttribute('id')
        ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
        const rect = previousRoot.getBoundingClientRect()
        const parentRect = host.value!.getBoundingClientRect()
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${rect.left - parentRect.left}px`,
          top: `${rect.top - parentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: '2',
          contain: 'layout paint',
        })
        scrollPositions = [previousRoot, ...previousRoot.querySelectorAll<HTMLElement>('*')]
          .map((node, index) => ({ index, top: node.scrollTop, left: node.scrollLeft }))
          .filter((position) => position.top || position.left)
      }),
    )
    disposers.push(
      router.afterEach((to, _from, failure) => {
        if (failure && to.fullPath === destination && router.currentRoute.value.fullPath !== destination) finish()
      }),
    )
    disposers.push(
      app.hook('page:finish', async () => {
        await nextTick()
        if (!pending.value || destination !== router.currentRoute.value.fullPath) return
        const element = root()
        if (!element || element === previousRoot) return
        const transaction = version
        pending.value = false
        if (!active.value || reducedMotion.value || typeof element.animate !== 'function') {
          finish()
          return
        }
        const { name, duration } = active.value
        const distance = name === 'content-fade' ? 0 : name === 'content-soft' ? 6 : 8
        const incoming = element.animate(
          [
            { opacity: 0, transform: `translateY(-${distance}px)` },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration, easing: 'ease-out', fill: 'both' },
        )
        animations.push(incoming)
        if (ghost) {
          host.value!.appendChild(ghost)
          const nodes = [ghost, ...ghost.querySelectorAll<HTMLElement>('*')]
          for (const position of scrollPositions) {
            const node = nodes[position.index]
            if (node) {
              node.scrollTop = position.top
              node.scrollLeft = position.left
            }
          }
          const outgoing = ghost.animate(
            [
              { opacity: 1, transform: 'translateY(0)' },
              { opacity: 0, transform: `translateY(${distance}px)` },
            ],
            { duration, easing: 'ease-in', fill: 'both' },
          )
          animations.push(outgoing)
          void outgoing.finished.catch(() => {})
        }
        void incoming.finished.then(
          () => {
            if (transaction === version) finish()
          },
          () => {},
        )
        timer = setTimeout(() => {
          if (transaction === version) finish()
        }, duration + 80)
      }),
    )
  })
  watch(
    [reducedMotion, contentTransitionDuration],
    ([reduced, duration]) => {
      if (reduced || duration === 0) {
        active.value = false
        if (animations.length) finish()
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
