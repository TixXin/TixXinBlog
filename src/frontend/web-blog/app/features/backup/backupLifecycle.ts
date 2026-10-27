/** @file backupLifecycle.ts @description 内容包页面的生命周期：选项变化换票据、账号与内容库切换时保存或还原选择、离开确认与卸载收尾 */
import type { BackupOwner, BackupSession } from './backupSession'
import { resetJob } from './backupTransfer'

/** 换账号前按旧账号保存当前文件与选项 */
function saveSelection(s: BackupSession, actor: string | undefined, previousActor: string | undefined) {
  if (actor === previousActor || !previousActor) return
  s.selections.set(previousActor, {
    file: s.file.value,
    requestId: s.requestId.value,
    strategy: s.strategy.value,
    includeSettings: s.includeSettings.value,
  })
}

/** 还原新账号保存过的选择；初次恢复身份时保留登录前已选的文件 */
function restoreSelection(s: BackupSession, actor: string | undefined, initialRestore: boolean) {
  const prior = actor ? s.selections.get(actor) : undefined
  s.session.changingActor = true
  if (!(initialRestore && s.file.value && !s.session.selectionActor)) {
    s.file.value = prior?.file ?? null
    s.requestId.value = prior?.requestId ?? ''
    s.strategy.value = prior?.strategy ?? 'skip'
    s.includeSettings.value = prior?.includeSettings ?? false
  }
  s.session.selectionActor = actor
  s.session.changingActor = false
}

/** 换账号或换内容库：丢弃票据与最近记录，按账号保存并还原各自的文件和选项 */
function switchIdentity(
  s: BackupSession,
  [actor, context]: [string | undefined, string],
  [previousActor, previousContext]: [string | undefined, string],
) {
  const initialRestore = !s.session.identityInitialized && !previousActor && !!actor
  s.session.identityInitialized ||= !!actor
  saveSelection(s, actor, previousActor)
  if (!initialRestore) s.session.generation++
  s.session.recentVersion++
  if (!initialRestore) s.pending.value = s.guarded.value = false
  s.job.value = null
  s.session.jobOwner = null
  s.acknowledgement.value = ''
  s.recent.value = []
  s.recentError.value = ''
  if (actor !== previousActor) restoreSelection(s, actor, initialRestore)
  if (previousActor || context !== previousContext) s.error.value = s.ownershipMessage()
}

export function useBackupLifecycle(
  s: BackupSession,
  actions: { loadRecentFor: (owner: BackupOwner) => Promise<void>; read: (ticket: string) => Promise<void> },
) {
  watch(
    [s.strategy, s.includeSettings],
    () => {
      if (!s.session.changingActor && s.file.value) {
        s.requestId.value = crypto.randomUUID()
        resetJob(s)
      }
    },
    { flush: 'sync' },
  )
  watch(
    [() => s.auth.currentUser.value?.id, s.pageContext],
    (current, previous) => switchIdentity(s, current, previous),
    { flush: 'sync' },
  )
  onMounted(async () => {
    if (!(await s.auth.restore())) {
      if (s.session.alive) await navigateTo('/admin/login?next=/admin/maintenance')
      return
    }
    if (!s.session.alive) return
    const owner = s.captureOwner()
    await actions.loadRecentFor(owner)
    const query = s.route.query.import
    if (s.owns(owner) && typeof query === 'string' && /^[a-f0-9-]{36}$/.test(query)) await actions.read(query)
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (s.guarded.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => {
    s.session.alive = false
    s.session.generation++
    s.session.recentVersion++
    window.removeEventListener('beforeunload', beforeUnload)
  })
  onBeforeRouteLeave(() => !s.guarded.value || window.confirm(s.t('admin-system.backup.leaveConfirm')))
}
