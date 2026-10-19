/**
 * @file project.messages.ts
 * @description 项目展示、项目链接与封面校验的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const projectMessages = defineMessages({
  'project.idInvalid': { zh: '项目编号不合法', en: 'Invalid project ID' },
  'project.notFound': { zh: '项目不存在', en: 'Project not found' },
  'project.notFoundOrPrivate': { zh: '项目不存在或尚未公开', en: 'Project not found or not yet published' },
  'project.notFoundOrDeleted': { zh: '项目不存在或已删除', en: 'Project not found or has been deleted' },
  'project.submissionNotFound': {
    zh: '尚未找到此提交，请使用原提交标识重试',
    en: 'This submission was not found. Please retry with the original submission ID.',
  },
  'project.createRequiresFields': {
    zh: '创建项目需要标题和唯一提交标识，不能携带编辑版本',
    en: 'Creating a project requires a title and a unique submission ID, and cannot include an edit revision',
  },
  'project.editRequiresRevision': {
    zh: '编辑项目需要当前版本，不能携带创建标识',
    en: 'Editing a project requires the current revision and cannot include a creation ID',
  },
  'project.submissionHandled': {
    zh: '此提交已处理，请核查原项目',
    en: 'This submission has already been processed. Please check the original project.',
    code: ErrorCode.SubmissionConflict,
  },
  'project.coverInvalid': { zh: '请选择有效的媒体库封面', en: 'Choose a valid cover from the media library' },
  'project.modifiedKeepInput': {
    zh: '项目已被修改，请保留输入并重新读取',
    en: 'The project has been modified. Keep your input and reload.',
    code: ErrorCode.RevisionConflict,
  },
  'project.changedBeforeDelete': {
    zh: '项目已变化，请重新读取后确认删除',
    en: 'The project has changed. Please reload and confirm the deletion again.',
    code: ErrorCode.RevisionConflict,
  },
  'project.linkMalformed': {
    zh: '项目链接不能包含空白、控制字符或反斜杠',
    en: 'Project links cannot contain whitespace, control characters, or backslashes',
  },
  'project.linkInvalid': {
    zh: '项目链接需要完整的 HTTP(S) 地址，不能使用占位符或带凭据地址',
    en: 'Project links need a full HTTP(S) URL. Placeholders and URLs with credentials are not allowed.',
  },
  'project.linkTooLong': {
    zh: '规范化后的项目链接不能超过2048个字符',
    en: 'The normalized project link cannot exceed 2048 characters',
  },
  'project.tagEmpty': { zh: '技术标签名称不能为空', en: 'Tech tag names cannot be empty' },
  'project.linkKindDuplicate': {
    zh: '同一种项目链接只能填写一个地址',
    en: 'Each kind of project link can only have one URL',
  },
})
