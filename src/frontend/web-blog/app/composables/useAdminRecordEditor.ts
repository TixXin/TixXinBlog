/** @file useAdminRecordEditor.ts @description 后台实体记录编辑器通用核心，管理账号隔离、提交核查、版本冲突与输入恢复 */
import { createRecordActions, useRecordLifecycle } from './recordEditor/lifecycle'
import { createRecordSave } from './recordEditor/save'
import { createRecordLoader, createRecordPersistence, createRecordSession } from './recordEditor/session'
import type { AdminRecordEditorOptions, AdminRecordRecovery } from './useAdminRecordEditor.types'
export * from './useAdminRecordEditor.types'

export function useAdminRecordEditor<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(options: AdminRecordEditorOptions<TForm, TEntity, TStatus, TRecovery>) {
  // 会话、恢复副本、读取、保存与生命周期分别在 recordEditor/ 下实现，这里只负责组装并保持对外返回结构。
  const session = createRecordSession(options)
  const persistence = createRecordPersistence(session)
  const { load } = createRecordLoader(session, persistence.accept)
  const { save } = createRecordSave(session, persistence)
  const actions = createRecordActions(session, persistence, load)
  useRecordLifecycle(session, persistence, load)
  const { change, reload, restoreRecovery, discardRecovery, mergeConflict } = actions
  return {
    ...session.state,
    dirty: session.dirty,
    change,
    save,
    reload,
    restoreRecovery,
    discardRecovery,
    persistLocal: persistence.persistLocal,
    mergeConflict,
  }
}
