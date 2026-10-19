/**
 * @file prompt.messages.ts
 * @description 图片提示词的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const promptMessages = defineMessages({
  'prompt.idInvalid': { zh: '提示词编号不合法', en: 'Invalid prompt ID' },
  'prompt.sourceUrlMalformed': {
    zh: '来源需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠',
    en: 'The source must be a full HTTP(S) URL without whitespace, control characters, or backslashes.',
  },
  'prompt.sourceUrlInvalid': {
    zh: '来源地址不合法，不能使用带凭据地址或超过 2048 个字符',
    en: 'Invalid source URL. It cannot contain credentials or exceed 2048 characters.',
  },
  'prompt.titleAndPromptRequired': { zh: '标题和提示词不能为空', en: 'Title and prompt are required' },
  'prompt.tagEmpty': { zh: '标签不能为空', en: 'Tags cannot be empty' },
  'prompt.notFoundOrUnpublished': { zh: '提示词不存在或尚未公开', en: 'Prompt not found or not yet published' },
  'prompt.submissionNotFound': {
    zh: '尚未找到此提交，请使用原提交标识重试',
    en: 'This submission was not found yet. Please retry with the original submission ID.',
  },
  'prompt.createRequiresFields': {
    zh: '创建需要标题、提示词和唯一提交标识，不能携带编辑版本',
    en: 'Creating requires a title, prompt, and unique submission ID, and cannot include an edit revision.',
  },
  'prompt.editRequiresRevision': {
    zh: '编辑需要当前版本，不能携带创建标识',
    en: 'Editing requires the current revision and cannot include a creation ID.',
  },
  'prompt.submissionConflict': {
    zh: '此提交已处理，请核查原提示词',
    en: 'This submission has already been processed. Please check the original prompt.',
    code: ErrorCode.SubmissionConflict,
  },
  'prompt.mediaInvalid': { zh: '请选择有效的媒体库图片', en: 'Please select a valid image from the media library' },
  'prompt.notFound': { zh: '提示词不存在', en: 'Prompt not found' },
  'prompt.revisionConflict': {
    zh: '提示词已被修改，请保留输入并重新读取',
    en: 'This prompt has been modified. Keep your input and reload it.',
    code: ErrorCode.RevisionConflict,
  },
  'prompt.imageSourceExclusive': {
    zh: '必须恰好选择一种图片来源；切换时请明确清空另一来源',
    en: 'Choose exactly one image source; when switching, explicitly clear the other one.',
  },
})
