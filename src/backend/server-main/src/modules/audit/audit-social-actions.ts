/**
 * @file audit-social-actions.ts
 * @description 社交互动与订阅领域审计动作字典映射（评论、留言、友链、订阅）
 */
import type { MessageKey } from '../../common/i18n'

export const socialAuditActionKeys: Readonly<Record<string, MessageKey>> = {
  'comment.reply': 'audit.action.commentReply',
  'comment.delete': 'audit.action.commentDelete',
  'comment.moderate': 'audit.action.commentModerate',
  'comment.batch.moderate': 'audit.action.commentBatchModerate',
  'comment.batch.delete': 'audit.action.commentBatchDelete',
  'comment.policy': 'audit.action.commentPolicy',
  'flash.comment.moderate': 'audit.action.flashCommentModerate',
  'flash.comment.delete': 'audit.action.flashCommentDelete',
  'flash.comment.batch.moderate': 'audit.action.flashCommentBatchModerate',
  'flash.comment.batch.delete': 'audit.action.flashCommentBatchDelete',
  'moment.comment.reply': 'audit.action.momentCommentReply',
  'moment.comment.moderate': 'audit.action.momentCommentModerate',
  'moment.comment.delete': 'audit.action.momentCommentDelete',
  'guestbook.create': 'audit.action.guestbookCreate',
  'guestbook.update': 'audit.action.guestbookUpdate',
  'guestbook.delete': 'audit.action.guestbookDelete',
  'guestbook.batch.moderate': 'audit.action.guestbookBatchModerate',
  'guestbook.batch.delete': 'audit.action.guestbookBatchDelete',
  'subscription.create': 'audit.action.subscriptionCreate',
  'subscription.update': 'audit.action.subscriptionUpdate',
  'subscription.delete': 'audit.action.subscriptionDelete',
  'subscription.sort': 'audit.action.subscriptionSort',
  'subscription.favicon': 'audit.action.subscriptionFavicon',
  'link.create': 'audit.action.linkCreate',
  'link.update': 'audit.action.linkUpdate',
  'link.delete': 'audit.action.linkDelete',
  'link.settings': 'audit.action.linkSettings',
  'link.application.approve': 'audit.action.linkApplicationApprove',
  'link.application.reject': 'audit.action.linkApplicationReject',
}
