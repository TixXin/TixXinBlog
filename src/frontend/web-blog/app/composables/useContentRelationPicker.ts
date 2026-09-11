/** @file useContentRelationPicker.ts @description 三域关联选择器的数据和变更逻辑，独立隔离身份、内容库及迟到响应。 */
import type { Ref } from 'vue'
import type { ContentRelation, ContentRelationType, ManagedContentRelation } from '~/features/content-relation/types'
import { copyContentRelations } from '~/features/content-relation/editor'
export function useContentRelationPicker(
  value: Ref<ContentRelation[]>,
  source: Ref<ContentRelation | undefined>,
  enabled: Ref<boolean>,
  change: (value: ContentRelation[]) => void,
) {
  const api = useAdminApi(),
    auth = useCurrentUser(),
    context = useState<string>('page-content-context', () => '')
  const type = ref<ContentRelationType>('post'),
    q = ref(''),
    page = ref(1)
  const candidates = ref<ManagedContentRelation[]>([]),
    resolved = ref<ManagedContentRelation[]>([])
  const total = ref<number | null>(null),
    pending = ref(false),
    resolving = ref(false),
    error = ref(''),
    resolveError = ref('')
  let version = 0,
    resolveVersion = 0,
    alive = true,
    mounted = false
  const identity = () => `${auth.currentUser.value?.id ?? ''}:${context.value}`
  const key = (item: ContentRelation) => `${item.type}:${item.id}`
  async function load() {
    if (!enabled.value || !mounted) return
    const current = ++version,
      actor = identity()
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: ManagedContentRelation[]; total: number }>('/admin/content-relations', {
        query: { type: type.value, q: q.value.trim() || undefined, page: page.value },
      })
      if (!alive || current !== version || actor !== identity()) return
      candidates.value = result.items
      total.value = result.total
      if (page.value > Math.max(1, Math.ceil(result.total / 12))) {
        page.value = Math.max(1, Math.ceil(result.total / 12))
        await load()
      }
    } catch {
      if (alive && current === version && actor === identity()) {
        error.value = '关联内容读取失败，请重试'
        candidates.value = []
        total.value = null
      }
    } finally {
      if (alive && current === version) pending.value = false
    }
  }
  async function resolve() {
    if (!enabled.value || !mounted) return
    const current = ++resolveVersion,
      actor = identity(),
      snapshot = JSON.stringify(value.value)
    resolveError.value = ''
    if (!value.value.length) {
      resolved.value = []
      resolving.value = false
      return
    }
    resolving.value = true
    try {
      const result = await api<ManagedContentRelation[]>('/admin/content-relations/resolve', {
        method: 'POST',
        body: { relatedContent: copyContentRelations(value.value) },
      })
      if (alive && current === resolveVersion && actor === identity() && snapshot === JSON.stringify(value.value))
        resolved.value = result
    } catch {
      if (alive && current === resolveVersion && actor === identity()) {
        resolveError.value = '已选关联状态暂不可用，原有编号和顺序已保留'
        resolved.value = []
      }
    } finally {
      if (alive && current === resolveVersion) resolving.value = false
    }
  }
  function choose(item: ContentRelation) {
    if (
      !enabled.value ||
      value.value.length >= 12 ||
      value.value.some((existing) => key(existing) === key(item)) ||
      (source.value && key(source.value) === key(item))
    )
      return
    change([...copyContentRelations(value.value), { type: item.type, id: item.id }])
  }
  function remove(index: number) {
    if (enabled.value) change(copyContentRelations(value.value).filter((_, i) => i !== index))
  }
  function move(index: number, offset: number) {
    const next = copyContentRelations(value.value),
      target = index + offset
    if (!enabled.value || !next[index] || target < 0 || target >= next.length) return
    const item = next.splice(index, 1)[0]!
    next.splice(target, 0, item)
    change(next)
  }
  function search() {
    page.value = 1
    void load()
  }
  function setPage(value: number) {
    page.value = value
    void load()
  }
  function setType(value: ContentRelationType) {
    type.value = value
    search()
  }
  watch(
    () => JSON.stringify(value.value),
    () => {
      resolved.value = []
      void resolve()
    },
  )
  watch([enabled, () => identity()], () => {
    version++
    resolveVersion++
    candidates.value = []
    resolved.value = []
    total.value = null
    pending.value = false
    resolving.value = false
    if (enabled.value) {
      void load()
      void resolve()
    }
  })
  onMounted(() => {
    mounted = true
    void load()
    void resolve()
  })
  onScopeDispose(() => {
    alive = false
    version++
    resolveVersion++
  })
  const props = computed(() => ({
    selected: value.value.map(
      (item) =>
        resolved.value.find((target) => key(target) === key(item)) ?? {
          ...item,
          title: `内容 #${item.id}`,
          status: 'unknown',
          available: false,
        },
    ),
    candidates: candidates.value.map((item) => ({
      ...item,
      disabled:
        value.value.length >= 12 ||
        value.value.some((existing) => key(existing) === key(item)) ||
        (!!source.value && key(source.value) === key(item)),
    })),
    type: type.value,
    q: q.value,
    page: page.value,
    total: total.value,
    pending: pending.value,
    resolving: resolving.value,
    error: error.value,
    resolveError: resolveError.value,
    disabled: !enabled.value,
  }))
  return {
    props,
    choose,
    remove,
    move,
    search,
    setPage,
    setType,
    setQuery: (value: string) => {
      q.value = value
    },
    resolve,
  }
}
