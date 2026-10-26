/** @file library.ts @description 媒体库的筛选取值校验、列表与地址查询、上传文件校验、结果文案与引用标签键 */
import { apiResponseMessage } from '~/utils/apiError'
import type { Translate } from '~/utils/format'
import type { MediaAsset, MediaOrientation, MediaReferences, MediaRemovalResult, MediaUsage } from './types'

export const MEDIA_PAGE_SIZE = 20
/** 单次最多加入上传队列的文件数 */
export const MEDIA_UPLOAD_LIMIT = 10
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** 媒体库的筛选条件与页码 */
export interface MediaFilters {
  search: string
  deleted: string
  orientation: MediaOrientation
  usage: MediaUsage
  page: number
}

export function readMediaOrientation(value: unknown): MediaOrientation {
  return typeof value === 'string' && ['landscape', 'portrait', 'square'].includes(value)
    ? (value as MediaOrientation)
    : ''
}

export function readMediaUsage(value: unknown): MediaUsage {
  return typeof value === 'string' && ['used', 'unused'].includes(value) ? (value as MediaUsage) : ''
}

/** 地址里的页码：只接受正整数，其余回到第一页 */
export function readMediaPage(value: unknown) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function mediaLastPage(total: number) {
  return Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE))
}

/** 列表请求参数：空条件不发送 */
export function mediaListQuery(filters: MediaFilters) {
  return {
    page: filters.page,
    pageSize: MEDIA_PAGE_SIZE,
    search: filters.search || undefined,
    deleted: filters.deleted,
    orientation: filters.orientation || undefined,
    usage: filters.usage || undefined,
  }
}

/** 媒体页地址上的查询：只写非默认值，第一页不写页码 */
export function mediaAddressQuery(filters: MediaFilters) {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.deleted === 'true' ? { deleted: 'true' } : {}),
    ...(filters.orientation ? { orientation: filters.orientation } : {}),
    ...(filters.usage ? { usage: filters.usage } : {}),
    ...(filters.page > 1 ? { page: String(filters.page) } : {}),
  }
}

/** 可上传的文件：不超过 8 MB 的 JPEG、PNG 或 WebP */
export function isAcceptedMediaUpload(file: Pick<File, 'name' | 'size'>) {
  return file.size <= MAX_UPLOAD_BYTES && /\.(jpe?g|png|webp)$/i.test(file.name)
}

export function mediaErrorText(cause: unknown, t: Translate) {
  return cause instanceof Error ? cause.message : t('admin-media.mediaMessages.operationFailed')
}

export function referencedRemovalResult(asset: MediaAsset, refs: MediaReferences, t: Translate): MediaRemovalResult {
  return {
    id: asset.id,
    name: asset.name,
    status: 'referenced',
    message: t('admin-media.mediaMessages.referencedResult', { total: refs.total }),
    references: refs,
  }
}

/** 删除失败的结果：区分引用预检失败与删除请求失败，优先使用接口返回的说明 */
export function failedRemovalResult(asset: MediaAsset, cause: unknown, checked: boolean, t: Translate) {
  const message = apiResponseMessage(cause) ?? mediaErrorText(cause, t)
  return {
    id: asset.id,
    name: asset.name,
    status: 'failed',
    message: checked
      ? t('admin-media.mediaMessages.removeFailedRecheck', { message })
      : t('admin-media.mediaMessages.checkFailed', { message }),
  } satisfies MediaRemovalResult
}

export const mediaReferenceLabelKeys: Record<MediaReferences['items'][number]['kind'], string> = {
  post: 'admin-media.mediaLibrary.kind.post',
  revision: 'admin-media.mediaLibrary.kind.revision',
  flash: 'admin-media.mediaLibrary.kind.flash',
  site: 'admin-media.mediaLibrary.kind.site',
  'site-revision': 'admin-media.mediaLibrary.kind.siteRevision',
  comment: 'admin-media.mediaLibrary.kind.comment',
  'flash-comment': 'admin-media.mediaLibrary.kind.flashComment',
  moment: 'admin-media.mediaLibrary.kind.moment',
  'moment-comment': 'admin-media.mediaLibrary.kind.momentComment',
  guestbook: 'admin-media.mediaLibrary.kind.guestbook',
  gallery: 'admin-media.mediaLibrary.kind.gallery',
  project: 'admin-media.mediaLibrary.kind.project',
  link: 'admin-media.mediaLibrary.kind.link',
  'image-prompt': 'admin-media.mediaLibrary.kind.imagePrompt',
  subscription: 'admin-media.mediaLibrary.kind.subscription',
}

export const mediaRemovalStatusKeys: Record<MediaRemovalResult['status'], string> = {
  removed: 'admin-media.mediaLibrary.removal.removed',
  referenced: 'admin-media.mediaLibrary.removal.referenced',
  failed: 'admin-media.mediaLibrary.removal.failed',
}

/** 只有历史版本引用带版本号；当前内容的引用记录 revision 为 null，不能拼进标签。 */
export function mediaReferenceLabel(item: MediaReferences['items'][number], t: Translate) {
  const label = t(mediaReferenceLabelKeys[item.kind])
  const versioned = item.kind === 'revision' || item.kind === 'site-revision'
  return versioned && item.revision != null
    ? t('admin-media.mediaLibrary.references.versioned', { label, revision: item.revision })
    : label
}
