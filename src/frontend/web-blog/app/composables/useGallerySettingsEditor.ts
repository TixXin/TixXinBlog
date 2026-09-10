/** @file useGallerySettingsEditor.ts @description 可维护器材资料，绑定账号和内容库的草稿保护及版本冲突 */
import type { GallerySettings, GearItem } from '~/features/gallery/types'
export function useGallerySettingsEditor() {
  const repo = useGalleryRepository(),
    auth = useCurrentUser(),
    app = useNuxtApp(),
    context = useState<string>('page-content-context', () => '')
  const draft = ref<GallerySettings | null>(null),
    conflict = ref<GallerySettings | null>(null),
    recovery = ref<GearItem[] | null>(null),
    previousRecoveries = ref<{ key: string; gear: GearItem[] }[]>([])
  const pending = ref(false),
    ready = ref(false),
    error = ref(''),
    notice = ref(''),
    baseline = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value.gear) !== baseline.value)
  let actor = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const prefix = () => `tixxin-gallery-gear:${actor}`
  const key = () => `${prefix()}:${ownedContext}`
  function persist() {
    if (!import.meta.client || !actor || !dirty.value || !draft.value) return
    try {
      sessionStorage.setItem(key(), JSON.stringify({ context: ownedContext, gear: draft.value.gear }))
    } catch {
      error.value = '器材恢复副本保存失败，请保留当前页面并重试。'
    }
  }
  function readRecovery() {
    try {
      recovery.value = null
      previousRecoveries.value = []
      const keys = Object.keys(sessionStorage).filter((name) => name === prefix() || name.startsWith(`${prefix()}:`))
      for (const name of keys) {
        const raw = sessionStorage.getItem(name)
        if (!raw || raw.length > 30000) continue
        const value = JSON.parse(raw) as { context: string; gear: GearItem[] }
        if (
          typeof value.context === 'string' &&
          Array.isArray(value.gear) &&
          value.gear.length <= 12 &&
          value.gear.every(
            (item) =>
              ['lucide:camera', 'lucide:circle', 'lucide:smartphone'].includes(item.icon) &&
              typeof item.name === 'string' &&
              item.name.length <= 80 &&
              typeof item.description === 'string' &&
              item.description.length <= 300,
          )
        ) {
          const gear = value.gear.map(({ icon, name, description }) => ({ icon, name, description }))
          if (value.context === ownedContext) recovery.value = gear
          else previousRecoveries.value.push({ key: name, gear })
        }
      }
    } catch {
      error.value = '器材恢复副本无法读取。'
    }
  }
  async function load() {
    if (pending.value) return
    persist()
    const version = ++generation
    pending.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error('请先登录博主账号。')
      const user = auth.currentUser.value!.id,
        startedContext = context.value
      const value = await repo.settings()
      if (!alive || version !== generation || auth.currentUser.value?.id !== user || context.value !== startedContext)
        return
      actor = user
      ownedContext = startedContext
      draft.value = value
      baseline.value = JSON.stringify(value.gear)
      conflict.value = null
      ready.value = true
      readRecovery()
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : '器材设置读取失败'
    } finally {
      if (alive && version === generation) pending.value = false
    }
  }
  async function save() {
    if (!draft.value || pending.value || !ready.value || !dirty.value) return
    const user = auth.currentUser.value?.id,
      version = generation,
      captured = JSON.stringify(draft.value.gear)
    if (!user || actor !== user || context.value !== ownedContext) return
    persist()
    pending.value = true
    error.value = ''
    notice.value = ''
    const owns = () =>
      alive && generation === version && auth.currentUser.value?.id === user && context.value === ownedContext
    try {
      const value = await repo.saveSettings({
        gear: JSON.parse(captured) as GearItem[],
        revision: draft.value.revision,
      })
      if (!owns()) return
      draft.value = value
      baseline.value = JSON.stringify(value.gear)
      conflict.value = null
      recovery.value = null
      try {
        sessionStorage.removeItem(key())
      } catch {
        error.value = '设置已保存，但本标签页副本未能移除。'
      }
      notice.value = '器材资料已保存。'
      void app.runWithContext(() => refreshNuxtData('gallery-metadata'))
    } catch (cause) {
      if (!owns()) return
      error.value = cause instanceof Error ? cause.message : '保存失败，输入已保留'
      if ((cause as { statusCode?: number }).statusCode === 409) {
        try {
          const value = await repo.settings()
          if (owns()) conflict.value = value
        } catch {
          /* 等待连接恢复后核查版本。 */
        }
      }
    } finally {
      if (owns()) pending.value = false
    }
  }
  function restore() {
    if (draft.value && recovery.value && ready.value && !pending.value) {
      draft.value.gear = recovery.value
      recovery.value = null
    }
  }
  function merge() {
    if (draft.value && conflict.value) {
      draft.value.revision = conflict.value.revision
      conflict.value = null
      notice.value = '当前输入已保留，请核对后再次保存。'
    }
  }
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || pending.value) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  watch(draft, persist, { deep: true })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (actor && next !== actor) {
        persist()
        generation++
        pending.value = false
        ready.value = false
        if (next) {
          draft.value = null
          recovery.value = null
          previousRecoveries.value = []
          conflict.value = null
          actor = ''
          void load()
        }
      } else if (next && !ready.value && !pending.value) {
        if (draft.value && ownedContext === context.value) ready.value = true
        else void load()
      }
    },
  )
  watch(context, () => {
    if (actor && ownedContext !== context.value) {
      persist()
      generation++
      pending.value = false
      ready.value = false
      error.value = '内容库已恢复或切换，请刷新后重新核对器材设置。'
    }
  })
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(() => {
    if (pending.value) return false
    if (!dirty.value) return true
    persist()
    return window.confirm('器材资料尚未保存，已保留本标签页副本，确定离开吗？')
  })
  onScopeDispose(() => {
    persist()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
  return {
    draft,
    conflict,
    recovery,
    previousRecoveries,
    pending,
    ready,
    error,
    notice,
    dirty,
    load,
    save,
    restore,
    merge,
    persist,
  }
}
