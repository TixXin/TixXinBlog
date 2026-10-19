/**
 * @file comment.messages.ts
 * @description 文章评论与审核的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const commentMessages = defineMessages({
  'comment.notFound': { zh: '评论不存在', en: 'Comment not found' },
  'comment.parentNotFound': { zh: '父评论不存在', en: 'Parent comment not found' },
  'comment.postArchived': { zh: '文章已归档,无法评论', en: 'This post is archived and cannot be commented on' },
  'comment.depthExceeded': {
    zh: '评论层级超限(最深 3 层)',
    en: 'Comment nesting limit exceeded (3 levels max)',
  },
  'comment.submissionHandled': {
    zh: '此评论提交已处理或移除，请核对原结果',
    en: 'This comment submission was already processed or removed. Check the original result.',
    code: ErrorCode.SubmissionConflict,
  },
  'comment.dateRangeInvalid': {
    zh: '开始日期不能晚于结束日期',
    en: 'The start date cannot be later than the end date',
  },
  'comment.scopeChanged': {
    zh: '评论或回复范围已变化，请重新查看后确认',
    en: 'The comment or its replies have changed. Review them again before confirming.',
    code: ErrorCode.PreviewStale,
  },
  'comment.replyCountChanged': {
    zh: '回复数量已变化，请重新查看删除范围后确认',
    en: 'The number of replies has changed. Review the deletion scope again before confirming.',
    code: ErrorCode.PreviewStale,
  },
  'comment.replyEmpty': { zh: '回复不能为空', en: 'The reply cannot be empty' },
  'comment.policyUpdated': {
    zh: '审核策略已更新，请重新加载后比较',
    en: 'The moderation policy has been updated. Reload and compare.',
    code: ErrorCode.RevisionConflict,
  },
  'comment.moderationScopeChanged': {
    zh: '评论状态或回复范围已变化，请重新查看影响后确认',
    en: 'The comment status or its replies have changed. Review the impact again before confirming.',
    code: ErrorCode.PreviewStale,
  },
})
