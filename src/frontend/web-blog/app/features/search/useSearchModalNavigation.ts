/** @file useSearchModalNavigation.ts @description 搜索弹窗结果跳转、页面过渡监听与焦点归还管理 */
import type { Ref } from 'vue'
import type { SearchResultItem } from '~/composables/useSearch'

export function useSearchModalNavigation(options: { visible: Ref<boolean>; close: () => void }) {
  const { visible, close } = options
  const { t } = useI18n()
  const router = useRouter()
  const currentRoute = useRoute()
  const app = useNuxtApp()
  const { error: notifyNavigationError } = useToast()
  const { contentTransitionDuration } = useAppearanceSettings()

  let restoreTrigger = true
  let destination: string | null = null
  let waitForPageTransition = false

  const activePageTransition = useState<false | { duration: number }>('page-transition-current', () => false)
  const pageMotionCompleted = useState('page-motion-completed', () => 0)

  function focusDestination() {
    if (!destination || waitForPageTransition || visible.value || currentRoute.path !== destination) return
    if (document.querySelector('[role="dialog"]')) return
    destination = null
    void nextTick(() => {
      if (visible.value || document.querySelector('[role="dialog"]')) return
      const target =
        document.querySelector<HTMLElement>('main h1, main h2') ?? document.querySelector<HTMLElement>('main')
      if (!target) return
      const previousTabindex = target.getAttribute('tabindex')
      target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      target.addEventListener(
        'blur',
        () => {
          if (previousTabindex === null) target.removeAttribute('tabindex')
          else target.setAttribute('tabindex', previousTabindex)
        },
        { once: true },
      )
    })
  }

  watch(pageMotionCompleted, () => {
    waitForPageTransition = false
    focusDestination()
  })

  const removePageFinish = app.hook('page:finish', focusDestination)
  const removeTransitionFinish = app.hook('page:transition:finish', () => {
    waitForPageTransition = false
    focusDestination()
  })

  onBeforeUnmount(removePageFinish)
  onBeforeUnmount(removeTransitionFinish)

  watch(
    () => (activePageTransition.value ? activePageTransition.value.duration : 0),
    (duration) => {
      if (duration === 0) {
        waitForPageTransition = false
        void nextTick(focusDestination)
      }
    },
  )

  function resetNavigationState() {
    restoreTrigger = true
    destination = null
    waitForPageTransition = false
  }

  async function navigateTo(item: Pick<SearchResultItem, 'type' | 'url'>) {
    restoreTrigger = item.type === 'link'
    const targetRoute = router.resolve(item.url)
    const samePage = router.currentRoute.value.fullPath === targetRoute.fullPath
    destination = item.type === 'link' ? null : targetRoute.path
    waitForPageTransition =
      item.type !== 'link' && router.currentRoute.value.path !== targetRoute.path && contentTransitionDuration.value > 0
    close()
    if (item.type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else {
      try {
        const failure = await router.push(item.url)
        if (failure && !samePage) {
          destination = null
          document.querySelector<HTMLElement>('[data-focus-key="site-search"]')?.focus({ preventScroll: true })
        } else if (samePage) {
          focusDestination()
        }
      } catch {
        destination = null
        notifyNavigationError(t('layout.searchModal.navigationFailed'))
        document.querySelector<HTMLElement>('[data-focus-key="site-search"]')?.focus({ preventScroll: true })
      }
    }
  }

  function onResultClick(event: MouseEvent, item: Pick<SearchResultItem, 'type' | 'url'>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    void navigateTo(item)
  }

  return {
    restoreTrigger: () => restoreTrigger,
    focusDestination,
    resetNavigationState,
    navigateTo,
    onResultClick,
  }
}
