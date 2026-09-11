/** @file useAdminWorkspace.ts @description 后台主要滚动区和列表返回位置，按完整查询地址保存，等待异步内容可容纳后恢复 */
import type { Ref } from 'vue'
import { adminNavigation } from '~/features/admin/navigation'
export function useAdminWorkspace(main: Ref<HTMLElement | null>) {
  const route = useRoute(),
    router = useRouter(),
    app = useNuxtApp()
  const lists = useState<Record<string, string>>('admin-list-return-paths', () => ({}))
  const positions = useState<Record<string, number>>('admin-scroll-positions', () => ({}))
  let removeGuard: (() => void) | undefined, removeFinish: (() => void) | undefined
  let observer: ResizeObserver | undefined
  let desired: number | null = null
  function remember() {
    if (main.value) positions.value[route.fullPath] = main.value.scrollTop
  }
  function restore() {
    if (!main.value || desired === null) return
    main.value.scrollTop = desired
    if (Math.abs(main.value.scrollTop - desired) < 2) desired = null
  }
  const cancelRestore = () => {
    desired = null
  }
  onMounted(() => {
    const node = main.value!
    removeGuard = router.beforeEach((_to, from) => {
      positions.value[from.fullPath] = node.scrollTop
    })
    removeFinish = app.hook('page:finish', () => {
      restore()
    })
    observer = new ResizeObserver(restore)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    node.addEventListener('wheel', cancelRestore, { passive: true })
    node.addEventListener('touchstart', cancelRestore, { passive: true })
    node.addEventListener('keydown', cancelRestore)
    desired = positions.value[route.fullPath] ?? 0
    restore()
  })
  watch(
    () => route.fullPath,
    async () => {
      if (adminNavigation.some((item) => item.path === route.path)) lists.value[route.path] = route.fullPath
      desired = positions.value[route.fullPath] ?? 0
      await nextTick()
      main.value?.focus({ preventScroll: true })
      restore()
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    remember()
    removeGuard?.()
    removeFinish?.()
    observer?.disconnect()
    main.value?.removeEventListener('wheel', cancelRestore)
    main.value?.removeEventListener('touchstart', cancelRestore)
    main.value?.removeEventListener('keydown', cancelRestore)
  })
}
