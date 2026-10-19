/**
 * @file guestbook.messages.ts
 * @description 留言板公开读写与后台审核的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const guestbookMessages = defineMessages({
  // 留言板侧栏的静态交流规则，按请求语言返回
  'guestbook.rule.share': {
    zh: '欢迎分享技术经验、阅读感受和生活见闻。',
    en: 'Feel free to share technical experience, reading notes, and stories from everyday life.',
  },
  'guestbook.rule.respect': { zh: '请友善交流，尊重不同意见。', en: 'Be kind and respect different opinions.' },
  'guestbook.rule.noSpam': {
    zh: '请勿发布个人隐私、广告或与讨论无关的内容。',
    en: 'Do not post personal information, advertising, or off-topic content.',
  },
  'guestbook.notFound': { zh: '留言不存在', en: 'Message not found' },
  'guestbook.notFoundOrHidden': { zh: '留言不存在或暂不可见', en: 'Message not found or currently not visible' },
  'guestbook.notFoundOrPrivate': { zh: '留言不存在或尚未公开', en: 'Message not found or not yet published' },
  'guestbook.notFoundOrDeleted': { zh: '留言不存在或已删除', en: 'Message not found or has been deleted' },
  'guestbook.submissionHandled': {
    zh: '此留言提交已处理，请确认原留言',
    en: 'This message submission has already been processed. Please check the original message.',
    code: ErrorCode.SubmissionConflict,
  },
  'guestbook.replyTargetMissing': {
    zh: '引用的留言不存在或尚未公开，请保留正文并重新选择回复',
    en: 'The message you are replying to does not exist or is not yet published. Keep your text and choose again.',
  },
  'guestbook.stateChangeRequired': {
    zh: '请选择需要修改的审核或置顶状态',
    en: 'Choose a review or pin status to change',
  },
  'guestbook.statusChanged': {
    zh: '留言状态已变化，请重新读取后再操作',
    en: 'The message status has changed. Please reload and try again.',
    code: ErrorCode.RevisionConflict,
  },
  'guestbook.pinRequiresPublished': {
    zh: '只能置顶已公开留言',
    en: 'Only published messages can be pinned',
  },
  'guestbook.changedBeforeDelete': {
    zh: '留言已变化，请重新读取后确认删除',
    en: 'The message has changed. Please reload and confirm the deletion again.',
    code: ErrorCode.RevisionConflict,
  },
  'guestbook.idInvalid': { zh: '留言编号不合法', en: 'Invalid message ID' },
  'guestbook.cursorInvalid': {
    zh: '留言游标无效或筛选已变化，请重新加载',
    en: 'The message cursor is invalid or the filters have changed. Please reload.',
  },
})
