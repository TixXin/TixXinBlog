/** @file useAdminLinkEditor.ts @description 友链管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { LinkEditable, LinkStatus, ManagedLink } from '~/features/link/types'
import { linkForm, parseLinkRecovery } from '~/features/link/editor'
import type { LinkRecovery } from '~/features/link/editor'
import { useAdminRecordEditor } from './useAdminRecordEditor'

export function useAdminLinkEditor(initialId: number | null) {
  const repo = useLinkRepository()
  return useAdminRecordEditor<LinkEditable, ManagedLink, LinkStatus, LinkRecovery>({
    initialId,
    storagePrefix: 'blog-link-editor',
    recoveryVersion: 1,
    parseRecovery: parseLinkRecovery,
    createDefaultForm: () => linkForm(),
    entityToForm: (entity) => linkForm(entity),
    cloneForm: (form) => linkForm(form),
    canSave: (form) => Boolean(form.name.trim() && form.url.trim()),
    repo: {
      adminDetail: (id) => repo.adminDetail(id),
      submission: (requestId) => repo.submission(requestId),
      save: (body, requestId, id, revision) => repo.save(body, requestId, id, revision),
    },
    refreshKeys: ['links-feed', 'links-metadata'],
    redirectPath: (link) => `/admin/links/${link.id}`,
    messages: {
      loginRequired: 'admin-media.linkEditor.loginRequired',
      contextChangedOnLoad: 'admin-media.linkEditor.contextChangedOnLoad',
      migrationIssue: 'admin-media.linkEditor.migrationIssue',
      recoveryUnreadable: 'admin-media.linkEditor.recoveryUnreadable',
      loadFailed: 'admin-media.linkEditor.loadFailed',
      persistFailed: 'admin-media.linkEditor.persistFailed',
      contextChanged: 'admin-media.linkEditor.contextChanged',
      submissionDeleted: 'admin-media.linkEditor.submissionDeleted',
      saved: 'admin-media.linkEditor.saved',
      savedDirty: 'admin-media.linkEditor.verifiedDirty',
      saveFailed: 'admin-media.linkEditor.saveFailed',
      pendingHint: 'admin-media.linkEditor.pendingHint',
      reloadConfirm: 'admin-media.linkEditor.reloadConfirm',
      recoveryMismatch: 'admin-media.linkEditor.recoveryMismatch',
      restored: 'admin-media.linkEditor.restored',
      discardFailed: 'admin-media.linkEditor.discardFailed',
      merged: 'admin-media.linkEditor.merged',
      leaveConfirm: 'admin-media.linkEditor.leaveConfirm',
      contextSwitched: 'admin-media.linkEditor.contextSwitched',
      recoveryNotRemoved: 'admin-media.linkEditor.recoveryNotRemoved',
    },
  })
}
