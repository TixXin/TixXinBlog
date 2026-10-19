/**
 * @file gallery.messages.ts
 * @description 图库作品、器材配置与图片来源校验的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const galleryMessages = defineMessages({
  'gallery.idInvalid': { zh: '作品编号不合法', en: 'Invalid photo ID' },
  'gallery.uncategorized': { zh: '未分类', en: 'Uncategorized' },
  'gallery.notFound': { zh: '作品不存在', en: 'Photo not found' },
  'gallery.notFoundOrPrivate': { zh: '作品不存在或尚未公开', en: 'Photo not found or not yet published' },
  'gallery.notFoundOrDeleted': { zh: '作品不存在或已删除', en: 'Photo not found or has been deleted' },
  'gallery.submissionNotFound': {
    zh: '尚未找到此提交，请使用原提交标识重试',
    en: 'This submission was not found. Please retry with the original submission ID.',
  },
  'gallery.gearChanged': {
    zh: '器材配置已变化，请保留输入并重新读取',
    en: 'The gear settings have changed. Keep your input and reload.',
    code: ErrorCode.RevisionConflict,
  },
  'gallery.createRejectsRevision': {
    zh: '创建作品不能携带编辑版本',
    en: 'Creating a photo cannot include an edit revision',
  },
  'gallery.createRequiresFields': {
    zh: '创建作品需要标题、图片来源和提交标识',
    en: 'Creating a photo requires a title, an image source, and a submission ID',
  },
  'gallery.editRequiresRevision': {
    zh: '编辑需要当前版本，不能携带创建标识',
    en: 'Editing requires the current revision and cannot include a creation ID',
  },
  'gallery.submissionHandled': {
    zh: '此提交已处理，请核查原作品',
    en: 'This submission has already been processed. Please check the original photo.',
    code: ErrorCode.SubmissionConflict,
  },
  'gallery.mediaInvalid': { zh: '请选择有效的媒体库图片', en: 'Choose a valid image from the media library' },
  'gallery.modifiedKeepInput': {
    zh: '作品已被修改，请保留输入并重新读取',
    en: 'The photo has been modified. Keep your input and reload.',
    code: ErrorCode.RevisionConflict,
  },
  'gallery.sourceExclusive': {
    zh: '每件作品必须恰好选择一种图片来源；切换时请明确清空另一来源',
    en: 'Each photo must have exactly one image source. When switching, clear the other source explicitly.',
  },
  'gallery.changedBeforeDelete': {
    zh: '作品已变化，请重新读取后确认删除',
    en: 'The photo has changed. Please reload and confirm the deletion again.',
    code: ErrorCode.RevisionConflict,
  },
  'gallery.imageUrlMalformed': {
    zh: '图片需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠',
    en: 'Images need a full HTTP(S) URL without whitespace, control characters, or backslashes',
  },
  'gallery.imageUrlManaged': {
    zh: '媒体库图片请通过媒体选择器关联，不能填写为外部图片',
    en: 'Attach media library images with the media picker instead of entering them as external images',
  },
  'gallery.imageUrlInvalid': {
    zh: '图片地址不合法，不能使用不完整地址或带凭据地址',
    en: 'Invalid image URL. Incomplete URLs and URLs with credentials are not allowed.',
  },
})
