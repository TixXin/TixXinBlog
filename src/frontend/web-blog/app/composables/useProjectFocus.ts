/** @file useProjectFocus.ts @description 项目稳定编号深链独立于列表筛选；迟到详情、撤回和缺失不覆盖当前目标。 */
import type { ProjectItem } from '~/features/project/types'
export function useProjectFocus() {
  const route = useRoute(),
    router = useRouter(),
    repo = useProjectRepository()
  const target = computed(() => (typeof route.query.project === 'string' ? route.query.project : ''))
  const item = ref<ProjectItem | null>(null),
    pending = ref(false),
    error = ref('')
  let generation = 0,
    controller: AbortController | undefined,
    alive = true
  async function load() {
    const current = ++generation
    controller?.abort()
    item.value = null
    error.value = ''
    pending.value = false
    if (!target.value) return
    const id = Number(target.value)
    if (!/^\d+$/.test(target.value) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
      error.value = '项目编号无效，请从项目列表继续浏览。'
      return
    }
    controller = new AbortController()
    pending.value = true
    try {
      const value = await repo.detail(id, controller.signal)
      if (alive && current === generation) item.value = value
    } catch (cause) {
      if (alive && current === generation) error.value = cause instanceof Error ? cause.message : '项目读取失败，请重试'
    } finally {
      if (alive && current === generation) pending.value = false
    }
  }
  function close() {
    return router.replace({ path: '/projects', query: { ...route.query, project: undefined } })
  }
  onMounted(load)
  watch(target, load)
  onScopeDispose(() => {
    alive = false
    generation++
    controller?.abort()
  })
  return { target, item, pending, error, load, close }
}
