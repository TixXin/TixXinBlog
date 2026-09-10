/** @file useAdminProject.ts @description 项目管理列表与版本化操作，迟到响应不跨查询或账号更新 */
import type { ProjectEditable, ProjectPage, ManagedProject } from '~/features/project/types'
import { projectQuery } from '~/features/project/query'
export function useAdminProjects() {
  const repo = useProjectRepository(),
    auth = useCurrentUser(),
    route = useRoute(),
    router = useRouter(),
    app = useNuxtApp()
  const context = useState<string>('page-content-context', () => '')
  const data = ref<ProjectPage<ManagedProject> | null>(null),
    pending = ref(false),
    error = ref(''),
    notice = ref(''),
    busy = ref<number[]>([])
  const mounted = ref(false)
  const acceptedKey = ref('')
  const query = computed(() => ({
    ...projectQuery(route.query),
    status: ['draft', 'published', 'withdrawn'].includes(String(route.query.status))
      ? String(route.query.status)
      : 'all',
  }))
  const key = computed(() => JSON.stringify(query.value))
  let generation = 0,
    alive = true
  async function load() {
    if (!mounted.value) return
    const version = ++generation,
      user = auth.currentUser.value?.id,
      requested = key.value,
      currentContext = context.value
    pending.value = true
    error.value = ''
    try {
      if (!user) throw new Error('请先登录博主账号。')
      const result = await repo.adminList(query.value)
      if (
        alive &&
        generation === version &&
        auth.currentUser.value?.id === user &&
        key.value === requested &&
        context.value === currentContext
      ) {
        data.value = result
        acceptedKey.value = requested
      }
    } catch (cause) {
      if (alive && generation === version) error.value = cause instanceof Error ? cause.message : '项目读取失败'
    } finally {
      if (alive && generation === version) pending.value = false
    }
  }
  function filter(patch: Record<string, string | number | undefined>) {
    return router.push({ query: { ...route.query, page: undefined, ...patch } })
  }
  async function mutate(project: ManagedProject, patch?: Partial<ProjectEditable>) {
    if (busy.value.includes(project.id) || pending.value || !auth.currentUser.value) return
    if (!patch && !window.confirm(`删除项目「${project.title}」？项目不再展示，其他内容的媒体引用会保留。`)) return
    const user = auth.currentUser.value.id,
      currentContext = context.value,
      requested = key.value
    busy.value.push(project.id)
    error.value = ''
    notice.value = ''
    try {
      if (patch) await repo.update(project.id, patch, project.revision)
      else await repo.remove(project.id, project.revision)
      if (!alive || auth.currentUser.value?.id !== user || currentContext !== context.value) return
      notice.value = patch ? '项目已更新。' : '项目已删除。'
      void app.runWithContext(() => refreshNuxtData(['projects-feed', 'projects-metadata']))
      if (requested === key.value) await load()
    } catch (cause) {
      if (!alive || auth.currentUser.value?.id !== user || currentContext !== context.value) return
      error.value = cause instanceof Error ? cause.message : '操作失败，请重新读取后核查结果'
      if ((cause as { statusCode?: number }).statusCode === 409) error.value += '；请重新读取当前版本后再操作。'
    } finally {
      if (alive && auth.currentUser.value?.id === user) busy.value = busy.value.filter((id) => id !== project.id)
    }
  }
  watch(key, () => {
    void load()
  })
  watch(
    () => auth.currentUser.value?.id,
    () => {
      generation++
      data.value = null
      busy.value = []
      if (auth.currentUser.value) void load()
      else pending.value = false
    },
  )
  watch(context, () => {
    generation++
    data.value = null
    busy.value = []
    void load()
  })
  onMounted(async () => {
    await auth.restore()
    mounted.value = true
    await load()
  })
  onScopeDispose(() => {
    alive = false
    generation++
  })
  return {
    data,
    pending,
    error,
    notice,
    busy,
    query,
    filter,
    load,
    mutate,
    isLoggedIn: auth.isLoggedIn,
    restoringPending: auth.restoringPending,
    stale: computed(() => !!data.value && acceptedKey.value !== key.value),
  }
}
