/**
 * @file media.messages.ts
 * @description 媒体库上传、读取与引用的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const mediaMessages = defineMessages({
  // 引用列表的兜底标题：站点资料（头像）引用没有可展示的内容标题
  'media.referenceSiteAvatar': { zh: '站点头像', en: 'Site avatar' },
  'media.tooLarge': { zh: '请选择不超过 8MB 的图片', en: 'Please choose an image no larger than 8 MB' },
  'media.fileNameInvalid': { zh: '文件名不合法', en: 'Invalid file name' },
  'media.fileTypeUnsupported': {
    zh: '文件名不合法，仅支持 JPEG、PNG 和 WebP',
    en: 'Invalid file name. Only JPEG, PNG, and WebP are supported.',
  },
  'media.contentUnsupported': { zh: '文件内容不是受支持的图片', en: 'The file is not a supported image' },
  'media.decodeFailed': {
    zh: '图片解码失败、尺寸过大或包含不支持的多帧内容',
    en: 'The image could not be decoded, is too large, or contains unsupported multiple frames.',
  },
  'media.notFound': { zh: '媒体不存在', en: 'Media not found' },
  // 宽度白名单是固定常量，中文与此前按「、」拼接的结果逐字一致（由单测核对），英文按英语习惯列举。
  'media.widthUnsupported': {
    zh: '图片宽度只支持 320、640、960、1280',
    en: 'Image width must be 320, 640, 960, or 1280',
  },
  'media.referenceMissing': {
    zh: '内容引用的媒体已移除或不存在，请重新选择图片',
    en: 'The referenced media has been removed or does not exist. Please choose another image.',
  },
  'media.uploadIdUsed': {
    zh: '上传标识已使用，请重新选择文件',
    en: 'This upload ID has already been used. Please choose the file again.',
    code: ErrorCode.SubmissionConflict,
  },
  'media.resourceIdMismatch': {
    zh: '资源标识对应的文件不同，请重新选择文件',
    en: 'This resource ID belongs to a different file. Please choose the file again.',
    code: ErrorCode.SubmissionConflict,
  },
  'media.saveFailed': { zh: '媒体保存失败，请稍后重试', en: 'Failed to save media. Please try again later.' },
  'media.notFoundOrRemoved': { zh: '媒体不存在或已移除', en: 'Media not found or removed' },
  'media.stillReferenced': {
    zh: '媒体仍有 {count} 处引用（含历史修订），不能移除',
    en: 'This media is still referenced in {count} places (including revision history) and cannot be removed.',
    code: ErrorCode.ResourceInUse,
  },
  'media.fileUnavailableForRestore': {
    zh: '文件暂不可用，不能恢复',
    en: 'The file is temporarily unavailable and cannot be restored.',
  },
  'media.fileUnavailable': { zh: '媒体文件暂不可用', en: 'The media file is temporarily unavailable' },
})
