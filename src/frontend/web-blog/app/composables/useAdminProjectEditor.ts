/** @file useAdminProjectEditor.ts @description 项目管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { ProjectEditable, ProjectPublicationStatus, ManagedProject } from '~/features/project/types'
import { projectForm, parseProjectRecovery } from '~/features/project/editor'
import type { ProjectRecovery } from '~/features/project/editor'
import { useAdminRecordEditor } from './useAdminRecordEditor'

export function useAdminProjectEditor(initialId: number | null) {
  const repo = useProjectRepository()
  return useAdminRecordEditor<ProjectEditable, ManagedProject, ProjectPublicationStatus, ProjectRecovery>({
    initialId,
    storagePrefix: 'blog-project-editor',
    recoveryVersion: 1,
    parseRecovery: parseProjectRecovery,
    createDefaultForm: () => projectForm(),
    entityToForm: (entity) => projectForm(entity),
    cloneForm: (form) => projectForm(form),
    canSave: (form) => Boolean(form.title.trim()),
    repo: {
      adminDetail: (id) => repo.adminDetail(id),
      submission: (requestId) => repo.submission(requestId),
      save: (body, requestId, id, revision) => repo.save(body, requestId, id, revision),
    },
    refreshKeys: ['projects-feed', 'projects-metadata'],
    redirectPath: (project) => `/admin/projects/${project.id}`,
    messages: {
      loginRequired: 'admin-media.projectEditor.loginRequired',
      contextChangedOnLoad: 'admin-media.projectEditor.contextChangedLoad',
      migrationIssue: 'admin-media.projectEditor.migrationPending',
      recoveryUnreadable: 'admin-media.projectEditor.recoveryReadFailed',
      loadFailed: 'admin-media.projectEditor.loadFailed',
      persistFailed: 'admin-media.projectEditor.localSaveFailed',
      contextChanged: 'admin-media.projectEditor.contextChanged',
      submissionDeleted: 'admin-media.projectEditor.submissionDeleted',
      saved: 'admin-media.projectEditor.saved',
      savedDirty: 'admin-media.projectEditor.savedWithChanges',
      saveFailed: 'admin-media.projectEditor.saveFailed',
      pendingHint: 'admin-media.projectEditor.pendingCreateSuffix',
      reloadConfirm: 'admin-media.projectEditor.reloadConfirm',
      recoveryMismatch: 'admin-media.projectEditor.recoveryMismatch',
      restored: 'admin-media.projectEditor.restored',
      discardFailed: 'admin-media.projectEditor.discardFailed',
      merged: 'admin-media.projectEditor.merged',
      leaveConfirm: 'admin-media.projectEditor.leaveConfirm',
      contextSwitched: 'admin-media.projectEditor.contextRestored',
    },
  })
}
