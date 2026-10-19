/**
 * @file moment.messages.ts
 * @description 朋友圈动态与互动的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const momentMessages = defineMessages({
  'moment.notFound': { zh: '动态不存在', en: 'Moment not found' },
  'moment.notFoundOrPrivate': { zh: '动态不存在或尚未公开', en: 'Moment not found or not yet published' },
  'moment.notFoundOrDeleted': { zh: '动态不存在或已删除', en: 'Moment not found or has been deleted' },
  'moment.submissionNotFound': {
    zh: '尚未找到这次提交保存的动态',
    en: 'No moment has been saved for this submission yet',
  },
  'moment.commentNotFound': { zh: '评论不存在', en: 'Comment not found' },
  'moment.commentTargetInvalid': {
    zh: '评论不存在、已删除或不属于这条动态',
    en: 'The comment does not exist, has been deleted, or does not belong to this moment',
  },
  'moment.commentSubmissionHandled': {
    zh: '此评论提交已处理，请确认原评论',
    en: 'This comment submission has already been processed. Please check the original comment.',
    code: ErrorCode.SubmissionConflict,
  },
  'moment.commentStatusChanged': {
    zh: '评论状态已改变，请重新加载后再操作',
    en: 'The comment status has changed. Please reload and try again.',
    code: ErrorCode.RevisionConflict,
  },
  'moment.linkInvalid': {
    zh: '链接只允许完整 HTTP(S) 地址或本站媒体资源',
    en: 'Links must be full HTTP(S) URLs or media from this site',
  },
  'moment.referenceExclusive': {
    zh: '站内文章和外链引用只能选择一种',
    en: 'Choose either a site post or an external link to reference, not both',
  },
  'moment.publishRequiresContent': {
    zh: '发布需要正文和唯一提交标识',
    en: 'Publishing requires content and a unique submission ID',
  },
  'moment.editRequiresRevision': {
    zh: '请先读取动态后再编辑',
    en: 'Please load the moment before editing it',
  },
  'moment.editRejectsRequestId': {
    zh: '编辑不接受发布提交标识',
    en: 'Edits do not accept a publish submission ID',
  },
  'moment.submissionHandled': {
    zh: '提交标识已处理，请重新读取动态',
    en: 'This submission ID has already been processed. Please reload the moment.',
    code: ErrorCode.SubmissionConflict,
  },
  'moment.updatedKeepInput': {
    zh: '动态已被更新，请保留输入并重新读取后再保存',
    en: 'The moment has been updated. Keep your input, reload, and then save again.',
    code: ErrorCode.RevisionConflict,
  },
  'moment.updatedBeforeDelete': {
    zh: '动态已被更新，请刷新后确认删除',
    en: 'The moment has been updated. Please refresh and confirm the deletion again.',
    code: ErrorCode.RevisionConflict,
  },
  'moment.postNotPublic': {
    zh: '只能引用已公开的站内文章',
    en: 'Only published site posts can be referenced',
  },
})
