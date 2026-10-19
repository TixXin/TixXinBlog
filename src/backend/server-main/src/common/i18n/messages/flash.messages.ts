/**
 * @file flash.messages.ts
 * @description 闪念及其评论的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const flashMessages = defineMessages({
  'flash.notFound': { zh: '闪念不存在', en: 'Flash note not found' },
  'flash.archivedAdminOnly': {
    zh: '归档内容请使用管理员接口读取',
    en: 'Use the admin API to read archived content',
  },
  'flash.ownerOnly': { zh: '此接口只提供本站公开闪念', en: "This endpoint only serves this site's public flash notes" },
  'flash.contentRequired': { zh: '闪念内容不能为空', en: 'The flash note content cannot be empty' },
  'flash.imageUrlInvalid': {
    zh: '图片只允许媒体资源链接或完整 HTTP(S) 地址',
    en: 'Images must be media library links or full HTTP(S) URLs',
  },
  'flash.commentStatusChanged': {
    zh: '评论状态已改变，请重新加载后再操作',
    en: 'The comment status has changed. Reload and try again.',
    code: ErrorCode.RevisionConflict,
  },
})
