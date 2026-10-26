/** @file session.ts @description 后台记录编辑器的会话上下文、本标签页恢复副本与读取：账号与内容库归属、请求代次和输入保护 */
import { editorRecoveryKey } from '~/utils/editorRecoveryStorage'
import { createDirtyTracker } from '~/utils/editorState'
import { currentTranslate } from '~/utils/format'
import { createEditorState, createRecordRecovery, readRecoveriesSafe } from '../useAdminRecordEditor.types'
import type { AdminRecordEditorOptions, AdminRecordRecovery } from '../useAdminRecordEditor.types'

export function createRecordSession<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(options: AdminRecordEditorOptions<TForm, TEntity, TStatus, TRecovery>) {
  const { initialId, storagePrefix: domain } = options
  const auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp()
  // 在 setup 内取翻译函数：失败处理发生在 await 之后仍可使用
  const t = currentTranslate()
  const context = useState<string>('page-content-context', () => '')
  const state = createEditorState<TForm, TEntity, TRecovery>(initialId, options.createDefaultForm())
  const { baseline, dirty } = createDirtyTracker(state.form)
  /** 会话归属与请求代次：账号、内容库变化或卸载后，旧请求的结果一律丢弃 */
  const session = { currentRecoveryKey: '', actor: '', requestId: '', ownedContext: '', generation: 0, alive: true }
  const storagePrefix = () => `${domain}:${session.actor}:${initialId ?? 'new'}`
  const storageKey = () => editorRecoveryKey(storagePrefix(), session.ownedContext)
  const owns = (user: string | undefined, version: number) =>
    session.alive &&
    session.generation === version &&
    auth.currentUser.value?.id === user &&
    session.ownedContext === context.value
  return { options, auth, router, app, t, context, state, baseline, dirty, session, storagePrefix, storageKey, owns }
}

export type RecordSession<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
> = ReturnType<typeof createRecordSession<TForm, TEntity, TStatus, TRecovery>>

/** 本标签页恢复副本的写入、服务器结果的接受，以及会话作废与重置 */
export function createRecordPersistence<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(s: RecordSession<TForm, TEntity, TStatus, TRecovery>) {
  const { options, state, session } = s
  const { form, id, revision, saved, serverVersion, recovery, previousRecoveries, pendingCreate } = state
  function persistLocal() {
    if (!import.meta.client || !session.actor || (!s.dirty.value && !pendingCreate.value)) return
    try {
      const value = createRecordRecovery({
        version: options.recoveryVersion ?? 1,
        context: session.ownedContext,
        id: id.value,
        revision: revision.value,
        requestId: session.requestId,
        form: options.cloneForm(form),
        pendingCreate: pendingCreate.value,
      })
      sessionStorage.setItem(s.storageKey(), JSON.stringify(value))
      state.localError.value = ''
    } catch {
      state.localError.value = s.t(options.messages.persistFailed)
    }
  }
  function accept(entity: TEntity, nextForm?: TForm) {
    saved.value = entity
    id.value = entity.id
    revision.value = entity.revision
    serverVersion.value = null
    const raw = options.entityToForm(entity)
    s.baseline.value = JSON.stringify(raw)
    Object.assign(form, nextForm ?? raw)
  }
  function invalidate(nextError = '') {
    persistLocal()
    session.generation++
    state.ready.value = state.saving.value = state.loading.value = false
    if (nextError) state.error.value = nextError
  }
  function resetSession(nextActor: string) {
    session.actor = nextActor
    session.requestId = session.currentRecoveryKey = ''
    session.ownedContext = s.context.value
    id.value = options.initialId
    revision.value = saved.value = serverVersion.value = recovery.value = pendingCreate.value = null
    previousRecoveries.value = []
    Object.assign(form, options.createDefaultForm())
    s.baseline.value = JSON.stringify(form)
  }
  return { persistLocal, accept, invalidate, resetSession }
}

export type RecordPersistence<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
> = ReturnType<typeof createRecordPersistence<TForm, TEntity, TStatus, TRecovery>>

/** 读取本标签页恢复副本与旧内容库副本，读取异常只提示不阻断编辑 */
function readRecordRecovery<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(s: RecordSession<TForm, TEntity, TStatus, TRecovery>) {
  const { options, state, session, t } = s
  const recovered = readRecoveriesSafe({
    storage: sessionStorage,
    prefix: s.storagePrefix(),
    context: session.ownedContext,
    parse: options.parseRecovery,
    fallbackKey: s.storageKey(),
  })
  state.recovery.value = recovered.recovery
  session.currentRecoveryKey = recovered.key
  state.previousRecoveries.value = recovered.previous
  if (recovered.migrationIssue) state.localError.value = t(options.messages.migrationIssue)
  if (recovered.failed) state.localError.value = t(options.messages.recoveryUnreadable)
}

/** 读取：恢复登录、认领会话、读取恢复副本，没有未保存改动时以服务器详情为准 */
export function createRecordLoader<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(s: RecordSession<TForm, TEntity, TStatus, TRecovery>, accept: (entity: TEntity) => void) {
  const { options, state, session, t } = s
  const { messages } = options
  /** 确认登录并认领会话，返回当前账号；代次已过期时返回 null */
  async function claim(version: number) {
    if (!(await s.auth.restore())) throw new Error(t(messages.loginRequired))
    const user = s.auth.currentUser.value!.id
    if (!session.alive || version !== session.generation) return null
    session.actor ||= user
    session.ownedContext ||= s.context.value
    session.requestId ||= crypto.randomUUID()
    if (session.ownedContext !== s.context.value) throw new Error(t(messages.contextChangedOnLoad))
    return user
  }
  /** 要求替换或没有未保存改动时以服务器详情为准；返回 false 表示归属已变化 */
  async function syncDetail(user: string, version: number, replace: boolean) {
    if (!replace && (s.dirty.value || state.saved.value)) return true
    const entity = state.id.value ? await options.repo.adminDetail(state.id.value) : null
    if (!s.owns(user, version)) return false
    if (entity) accept(entity)
    return true
  }
  async function load(replace = false) {
    const version = ++session.generation
    state.loading.value = true
    state.error.value = ''
    try {
      const user = await claim(version)
      if (user === null) return
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      readRecordRecovery(s)
      if (!(await syncDetail(user, version, replace)) || !s.owns(user, version)) return
      state.ready.value = true
    } catch (cause) {
      if (session.alive && version === session.generation)
        state.error.value = cause instanceof Error ? cause.message : t(messages.loadFailed)
    } finally {
      if (session.alive && version === session.generation) state.loading.value = false
    }
  }
  return { load }
}
