/** @file useAdminTaxonomy.ts @description 后台专栏与标签管理流程：编辑态与未保存判断、读取、保存、删除与离开保护 */
import type { Translate } from '~/utils/format'
import type { AdminTaxonomyData, AdminTaxonomyItem, AdminTaxonomyKind } from './adminTaxonomy'
import { taxonomyColorOptions, taxonomyGroups, taxonomyWriteRequest } from './adminTaxonomy'

/** 编辑器字段与基线：有编辑对象或已输入名称且与基线不同即视为未保存 */
function createTaxonomyEditor(t: Translate) {
  const kind = ref<AdminTaxonomyKind>('folders')
  const label = ref('')
  const color = ref('sky')
  const editingId = ref<number | null>(null)
  const baseline = ref('')
  const snapshot = computed(() => JSON.stringify([kind.value, label.value, color.value]))
  const dirty = computed(() => (editingId.value !== null || !!label.value.trim()) && snapshot.value !== baseline.value)
  function allowDiscard() {
    return !dirty.value || window.confirm(t('admin-content.taxonomy.discardConfirm'))
  }
  function resetEditor() {
    if (!allowDiscard()) return
    editingId.value = null
    label.value = ''
    color.value = 'sky'
    baseline.value = snapshot.value
  }
  function markSaved() {
    baseline.value = snapshot.value
  }
  return { kind, label, color, editingId, baseline, snapshot, dirty, allowDiscard, resetEditor, markSaved }
}

export function useAdminTaxonomy() {
  const { t } = useI18n()
  const api = useAdminApi()
  const { success } = useToast()
  const data = ref<AdminTaxonomyData | null>(null)
  const pending = ref(false)
  const ready = ref(false)
  const working = ref(false)
  const saving = ref(false)
  const error = ref('')
  const editor = createTaxonomyEditor(t)
  const colors = computed(() => taxonomyColorOptions(t))
  const groups = computed(() => taxonomyGroups(data.value, t))
  async function load() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      data.value = await api<AdminTaxonomyData>('/admin/taxonomy')
      ready.value = true
    } catch {
      error.value = t('admin-content.taxonomy.loadFailed')
    } finally {
      pending.value = false
    }
  }
  const state = { data, pending, ready, working, saving, error, colors, groups }
  const writes = createTaxonomyWrites({ ...state, editor, api, success, t, load })
  useTaxonomyLifecycle({ editor, working, load })
  return { ...state, ...editor, load, ...writes }
}

type WriteContext = {
  editor: ReturnType<typeof createTaxonomyEditor>
  api: ReturnType<typeof useAdminApi>
  success: (message: string) => void
  t: Translate
  load: () => Promise<void>
  working: Ref<boolean>
  saving: Ref<boolean>
  pending: Ref<boolean>
  error: Ref<string>
}

/** 保存、删除与编辑入口：写入成功后清除文章读取缓存并重新读取 */
function createTaxonomyWrites(ctx: WriteContext) {
  const { editor, api, t, working, pending, error } = ctx
  const clearPostReads = () => clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
  async function save() {
    if (working.value || pending.value) return
    working.value = true
    ctx.saving.value = true
    error.value = ''
    try {
      const request = taxonomyWriteRequest({
        kind: editor.kind.value,
        editingId: editor.editingId.value,
        label: editor.label.value,
        color: editor.color.value,
      })
      await api(request.path, { method: request.method, body: request.body })
      editor.markSaved()
      editor.resetEditor()
      clearPostReads()
      ctx.success(t('admin-content.taxonomy.saved'))
      await ctx.load()
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.taxonomy.saveFailed')
    } finally {
      working.value = false
      ctx.saving.value = false
    }
  }
  return { save, ...createTaxonomyItemActions(ctx, clearPostReads) }
}

function createTaxonomyItemActions(ctx: WriteContext, clearPostReads: () => void) {
  const { editor, api, t, working, pending, error } = ctx
  function edit(type: AdminTaxonomyKind, item: AdminTaxonomyItem, focus: () => void) {
    if (working.value || pending.value || !editor.allowDiscard()) return
    editor.kind.value = type
    editor.editingId.value = item.id
    editor.label.value = item.label
    editor.color.value = item.color ?? 'sky'
    editor.markSaved()
    void nextTick(focus)
  }
  async function remove(type: AdminTaxonomyKind, item: AdminTaxonomyItem) {
    const confirmKey =
      type === 'folders' ? 'admin-content.taxonomy.deleteFolderConfirm' : 'admin-content.taxonomy.deleteTagConfirm'
    if (working.value || item.total || !window.confirm(t(confirmKey, { label: item.label }))) return
    working.value = true
    error.value = ''
    try {
      await api(`/admin/taxonomy/${type}/${item.id}`, { method: 'DELETE' })
      if (editor.kind.value === type && editor.editingId.value === item.id) {
        editor.markSaved()
        editor.resetEditor()
      }
      clearPostReads()
      ctx.success(t('admin-content.taxonomy.deleted'))
      await ctx.load()
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.taxonomy.deleteFailed')
    } finally {
      working.value = false
    }
  }
  return { edit, remove }
}

/** 挂载时记录空白基线并读取；未保存时提示离开，切换路由前须确认放弃 */
function useTaxonomyLifecycle(ctx: {
  editor: ReturnType<typeof createTaxonomyEditor>
  working: Ref<boolean>
  load: () => Promise<void>
}) {
  const { editor, working, load } = ctx
  const { restore } = useCurrentUser()
  function beforeUnload(event: BeforeUnloadEvent) {
    if (editor.dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onBeforeRouteLeave(() => !working.value && editor.allowDiscard())
  onMounted(async () => {
    editor.markSaved()
    window.addEventListener('beforeunload', beforeUnload)
    if (await restore()) await load()
    else await navigateTo({ path: '/admin/login', query: { next: '/admin/taxonomy' } })
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
}
