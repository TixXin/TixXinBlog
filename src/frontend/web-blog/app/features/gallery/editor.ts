/** @file editor.ts @description 图库编辑字段白名单与绑定内容上下文的恢复副本 */
import type { GalleryEditable, ManagedPhoto } from './types'
export function galleryForm(photo?: Partial<ManagedPhoto>): GalleryEditable {
  return {
    source: photo?.source ?? (photo?.externalUrl ? 'external' : 'media'),
    mediaId: photo?.mediaId ?? '',
    externalUrl: photo?.externalUrl ?? '',
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
  version: 1 | 2
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
    (v.source === undefined || ['media', 'external'].includes(v.source)) &&
    (v.externalUrl === undefined || (typeof v.externalUrl === 'string' && v.externalUrl.length <= 2048)) &&
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
      ![1, 2].includes(v.version) ||
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
      version: 2,
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

export function galleryPayload(form: GalleryEditable) {
  const { source, mediaId, externalUrl, ...values } = form
  return {
    ...values,
    mediaId: source === 'external' ? null : mediaId,
    externalUrl: source === 'external' ? externalUrl : null,
  }
}

export function galleryUrlError(value: string): string {
  if (!value) return '请输入完整的图片地址'
  if (
    !/^https?:\/\/[^/]/i.test(value) ||
    /[\\\s]/u.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    value.length > 2048
  )
    return '请使用完整的 HTTP(S) 地址，不含空白、控制字符或反斜杠'
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      return '地址不完整或含有凭据'
    let decoded = value
    for (let i = 0; i < 2; i++)
      decoded = decoded.replace(/%([0-9a-f]{2})/gi, (_all, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    if (/\/api\/v1\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp/i.test(decoded))
      return '媒体库图片请通过媒体选择器关联'
  } catch {
    return '请输入完整有效的图片地址'
  }
  return ''
}
