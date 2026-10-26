/** @file useAdminRecordEditor.types.ts @description 后台实体记录编辑器类型定义与契约 */
import { onMounted, onScopeDispose, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { readEditorRecoveries } from '~/utils/editorRecoveryStorage'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'

export interface AdminRecordRecovery<TForm> {
  version: number
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: TForm
  pendingCreate: TForm | null
  savedAt: string
}

export type AdminRecordEditorMsgKey =
  | 'loginRequired'
  | 'contextChangedOnLoad'
  | 'migrationIssue'
  | 'recoveryUnreadable'
  | 'loadFailed'
  | 'persistFailed'
  | 'contextChanged'
  | 'submissionDeleted'
  | 'saved'
  | 'savedDirty'
  | 'saveFailed'
  | 'pendingHint'
  | 'reloadConfirm'
  | 'recoveryMismatch'
  | 'restored'
  | 'discardFailed'
  | 'merged'
  | 'leaveConfirm'
  | 'contextSwitched'

export type AdminRecordEditorMessages = Record<AdminRecordEditorMsgKey, string> & {
  recoveryNotRemoved?: string
}

export interface AdminRecordEditorRepository<TForm, TEntity> {
  adminDetail: (id: number) => Promise<TEntity | null>
  submission: (requestId: string) => Promise<{ state: 'saved'; item: TEntity } | { state: 'deleted'; id: number }>
  save: (body: TForm, requestId: string, id?: number, revision?: number) => Promise<TEntity>
}

export interface AdminRecordEditorOptions<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
> {
  initialId: number | null
  storagePrefix: string
  recoveryVersion?: number
  parseRecovery: (raw: string | null) => TRecovery | null
  createDefaultForm: () => TForm
  entityToForm: (entity: TEntity) => TForm
  cloneForm: (form: TForm) => TForm
  canSave: (form: TForm) => boolean
  processAccepted?: (accepted: TForm, currentForm: TForm) => TForm
  repo: AdminRecordEditorRepository<TForm, TEntity>
  refreshKeys: string[]
  redirectPath: (entity: TEntity) => string
  messages: AdminRecordEditorMessages
}

/** 写入本标签页恢复副本的字段 */
export type RecordRecoveryInput<TForm> = Omit<AdminRecordRecovery<TForm>, 'savedAt'>

export function createRecordRecovery<TForm>(input: RecordRecoveryInput<TForm>): AdminRecordRecovery<TForm> {
  const { version, context, id, revision, requestId, form, pendingCreate } = input
  return { version, context, id, revision, requestId, form, pendingCreate, savedAt: new Date().toISOString() }
}

export function isPendingCreateMatched<TForm extends { status: string }>(
  pending: TForm | null,
  form: TForm,
  clone: (f: TForm) => TForm,
): boolean {
  return !pending || JSON.stringify({ ...clone(form), status: pending.status }) === JSON.stringify(pending)
}

export function removeRecoverySafe(key: string): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** 读取恢复副本的位置与解析方式 */
export interface RecoveryReadInput<TRecovery> {
  storage: Storage | undefined
  prefix: string
  context: string
  parse: (raw: string | null) => TRecovery | null
  fallbackKey: string
}

export function readRecoveriesSafe<TRecovery extends { context: string; savedAt: string }>(
  input: RecoveryReadInput<TRecovery>,
): {
  recovery: TRecovery | null
  key: string
  previous: EditorRecoveryCopy<TRecovery>[]
  migrationIssue: boolean
  failed: boolean
} {
  const { storage, prefix, context, parse, fallbackKey } = input
  if (!storage) return { recovery: null, key: fallbackKey, previous: [], migrationIssue: false, failed: false }
  try {
    const copies = readEditorRecoveries<TRecovery>(storage, prefix, context, parse)
    return {
      recovery: copies.current?.value ?? null,
      key: copies.current?.key ?? fallbackKey,
      previous: copies.previous,
      migrationIssue: copies.migrationIssue,
      failed: false,
    }
  } catch {
    return { recovery: null, key: fallbackKey, previous: [], migrationIssue: false, failed: true }
  }
}

export function createEditorState<TForm extends object, TEntity, TRecovery>(
  initialId: number | null,
  defaultForm: TForm,
) {
  return {
    form: reactive(defaultForm) as TForm,
    id: ref<number | null>(initialId),
    revision: ref<number | null>(null),
    saved: ref<TEntity | null>(null),
    serverVersion: ref<TEntity | null>(null),
    recovery: ref<TRecovery | null>(null),
    previousRecoveries: ref<EditorRecoveryCopy<TRecovery>[]>([]),
    pendingCreate: ref<TForm | null>(null),
    ready: ref(false),
    loading: ref(false),
    saving: ref(false),
    error: ref(''),
    notice: ref(''),
    localError: ref(''),
  }
}

export function useEditorLifecycle(
  persist: () => void,
  shouldGuard: () => boolean,
  isSaving: () => boolean,
  confirmLeave: () => boolean,
) {
  const unload = (event: BeforeUnloadEvent) => {
    if (shouldGuard()) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => window.addEventListener('beforeunload', unload))
  onBeforeRouteLeave(() => {
    if (isSaving()) return false
    if (!shouldGuard()) return true
    persist()
    return confirmLeave()
  })
  onScopeDispose(() => {
    persist()
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
}
