/** @file editor.ts @description 图库编辑字段白名单与绑定内容上下文的恢复副本 */
import type { GalleryEditable, ManagedPhoto } from './types'
export function galleryForm(photo?: Partial<ManagedPhoto>): GalleryEditable {
  return {
    mediaId: photo?.mediaId ?? '',
    title: photo?.title ?? '',
    description: photo?.description ?? '',
    category: photo?.category ?? '',
    takenOn: photo?.takenOn ?? null,
    location: photo?.location ?? '',
    device: photo?.device ?? '',
    status: photo?.status ?? 'draft',
    sortOrder: photo?.sortOrder ?? 0,
  }
}
export interface GalleryRecovery {
  version: 1
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: GalleryEditable
  pendingCreate: GalleryEditable | null
  savedAt: string
}
export function validGalleryForm(value: unknown): value is GalleryEditable {
  if (!value || typeof value !== 'object') return false
  const v = value as GalleryEditable
  return (
    typeof v.mediaId === 'string' &&
    (!v.mediaId || /^[0-9a-f-]{36}$/i.test(v.mediaId)) &&
    [
      [v.title, 160],
      [v.description, 5000],
      [v.category, 40],
      [v.location, 160],
      [v.device, 160],
    ].every(([text, max]) => typeof text === 'string' && text.length <= Number(max)) &&
    (v.takenOn === null ||
      (typeof v.takenOn === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(v.takenOn) &&
        Number.isFinite(Date.parse(v.takenOn)))) &&
    ['draft', 'published', 'withdrawn'].includes(v.status) &&
    Number.isInteger(v.sortOrder) &&
    Math.abs(v.sortOrder) <= 1000000
  )
}
export function parseGalleryRecovery(raw: string | null): GalleryRecovery | null {
  if (!raw || raw.length > 100000) return null
  try {
    const v = JSON.parse(raw) as GalleryRecovery
    if (
      v.version !== 1 ||
      typeof v.context !== 'string' ||
      v.context.length > 200 ||
      typeof v.requestId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(v.requestId) ||
      typeof v.savedAt !== 'string' ||
      (v.id !== null && (!Number.isSafeInteger(v.id) || v.id < 1)) ||
      (v.revision !== null && (!Number.isSafeInteger(v.revision) || v.revision < 0)) ||
      !validGalleryForm(v.form) ||
      (v.pendingCreate !== null && !validGalleryForm(v.pendingCreate))
    )
      return null
    return {
      version: 1,
      context: v.context,
      id: v.id,
      revision: v.revision,
      requestId: v.requestId,
      form: galleryForm(v.form),
      pendingCreate: v.pendingCreate ? galleryForm(v.pendingCreate) : null,
      savedAt: v.savedAt,
    }
  } catch {
    return null
  }
}
