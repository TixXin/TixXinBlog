/** @file useAdminGalleryEditor.ts @description 图库管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { GalleryEditable, GalleryStatus, ManagedPhoto } from '~/features/gallery/types'
import { galleryForm, galleryUrlError, parseGalleryRecovery } from '~/features/gallery/editor'
import type { GalleryRecovery } from '~/features/gallery/editor'
import { useAdminRecordEditor } from './useAdminRecordEditor'

export function useAdminGalleryEditor(initialId: number | null) {
  const repo = useGalleryRepository()
  return useAdminRecordEditor<GalleryEditable, ManagedPhoto, GalleryStatus, GalleryRecovery>({
    initialId,
    storagePrefix: 'blog-gallery-editor',
    recoveryVersion: 2,
    parseRecovery: parseGalleryRecovery,
    createDefaultForm: () => galleryForm(),
    entityToForm: (entity) => galleryForm(entity),
    cloneForm: (form) => galleryForm(form),
    canSave: (form) =>
      Boolean(form.title.trim()) &&
      (form.source === 'external' ? !galleryUrlError(form.externalUrl) : Boolean(form.mediaId)),
    processAccepted: (accepted, currentForm) => {
      // 另一来源的未提交输入继续保留在表单及恢复副本，不发送给 API。
      if (currentForm.source === accepted.source) {
        if (accepted.source === 'media') accepted.externalUrl = currentForm.externalUrl
        else accepted.mediaId = currentForm.mediaId
      }
      return accepted
    },
    repo: {
      adminDetail: (id) => repo.adminDetail(id),
      submission: (requestId) => repo.submission(requestId),
      save: (body, requestId, id, revision) => repo.save(body, requestId, id, revision),
    },
    refreshKeys: ['gallery-feed', 'gallery-metadata'],
    redirectPath: (photo) => `/admin/gallery/${photo.id}`,
    messages: {
      loginRequired: 'admin-media.galleryEditor.loginRequired',
      contextChangedOnLoad: 'admin-media.galleryEditor.contextChangedOnLoad',
      migrationIssue: 'admin-media.galleryEditor.migrationIssue',
      recoveryUnreadable: 'admin-media.galleryEditor.recoveryUnreadable',
      loadFailed: 'admin-media.galleryEditor.loadFailed',
      persistFailed: 'admin-media.galleryEditor.persistFailed',
      contextChanged: 'admin-media.galleryEditor.contextChanged',
      submissionDeleted: 'admin-media.galleryEditor.submissionDeleted',
      saved: 'admin-media.galleryEditor.saved',
      savedDirty: 'admin-media.galleryEditor.verifiedDirty',
      saveFailed: 'admin-media.galleryEditor.saveFailed',
      pendingHint: 'admin-media.galleryEditor.pendingHint',
      reloadConfirm: 'admin-media.galleryEditor.reloadConfirm',
      recoveryMismatch: 'admin-media.galleryEditor.recoveryMismatch',
      restored: 'admin-media.galleryEditor.restored',
      discardFailed: 'admin-media.galleryEditor.discardFailed',
      merged: 'admin-media.galleryEditor.merged',
      leaveConfirm: 'admin-media.galleryEditor.leaveConfirm',
      contextSwitched: 'admin-media.galleryEditor.contextSwitched',
    },
  })
}
