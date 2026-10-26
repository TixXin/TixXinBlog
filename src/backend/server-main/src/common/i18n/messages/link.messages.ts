/**
 * @file link.messages.ts
 * @description 友链展示、友链规则与地址头像校验的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const linkMessages = defineMessages({
  'link.idInvalid': { zh: '友链编号不合法', en: 'Invalid friend link ID' },
  'link.notFound': { zh: '友链不存在', en: 'Friend link not found' },
  'link.notFoundOrPrivate': { zh: '友链不存在或暂未公开', en: 'Friend link not found or not yet published' },
  'link.notFoundOrDeleted': { zh: '友链不存在或已删除', en: 'Friend link not found or has been deleted' },
  'link.submissionNotFound': { zh: '尚未找到此提交', en: 'This submission was not found' },
  'link.rulesChanged': {
    zh: '友链规则已变化，请保留输入并重新读取',
    en: 'The friend link rules have changed. Keep your input and reload.',
    code: ErrorCode.RevisionConflict,
  },
  'link.createRequiresFields': {
    zh: '创建友链需要名称、地址和唯一提交标识，不能携带编辑版本',
    en: 'Creating a friend link requires a name, a URL, and a unique submission ID, and cannot include an edit revision',
  },
  'link.editRequiresRevision': {
    zh: '编辑友链需要当前版本，不能携带创建标识',
    en: 'Editing a friend link requires the current revision and cannot include a creation ID',
  },
  'link.submissionHandled': {
    zh: '此提交已处理，请核查原友链',
    en: 'This submission has already been processed. Please check the original friend link.',
    code: ErrorCode.SubmissionConflict,
  },
  'link.modifiedKeepInput': {
    zh: '友链已被修改，请保留输入并重新读取',
    en: 'The friend link has been modified. Keep your input and reload.',
    code: ErrorCode.RevisionConflict,
  },
  'link.urlExists': {
    zh: '该地址已存在于友链 #{id}，请编辑已有友链或修改地址',
    en: 'This URL is already used by friend link #{id}. Edit that link or change the URL.',
  },
  'link.urlPublished': {
    zh: '该地址的友链 #{id} 已公开，请修改地址或先下架原友链',
    en: 'Friend link #{id} with this URL is already published. Change the URL or unpublish the original link first.',
  },
  'link.logoExclusiveClear': {
    zh: '媒体库图片和外部头像只能选择一种，请清除另一项后保存',
    en: 'Choose either a media library image or an external avatar. Clear the other one before saving.',
  },
  'link.logoMediaInvalid': { zh: '请选择有效的媒体库头像', en: 'Choose a valid avatar from the media library' },
  'link.changedBeforeDelete': {
    zh: '友链已变化，请重新读取后确认删除',
    en: 'The friend link has changed. Please reload and confirm the deletion again.',
    code: ErrorCode.RevisionConflict,
  },
  'link.urlMalformed': {
    zh: '友链需要完整的 HTTP(S) 地址，不能包含空白、控制字符或反斜杠',
    en: 'Friend links need a full HTTP(S) URL without whitespace, control characters, or backslashes',
  },
  'link.urlInvalid': {
    zh: '友链地址不合法，不能使用占位符或带凭据地址',
    en: 'Invalid friend link URL. Placeholders and URLs with credentials are not allowed.',
  },
  'link.urlTooLong': {
    zh: '规范化后的友链地址不能超过2048个字符',
    en: 'The normalized friend link URL cannot exceed 2048 characters',
  },
  'link.logoRequiresHttps': {
    zh: '外部头像需要完整的 HTTPS 地址',
    en: 'External avatars need a full HTTPS URL',
  },
  'link.logoManaged': {
    zh: '媒体库图片请通过媒体选择器关联，不能填写为外部头像',
    en: 'Attach media library images with the media picker instead of entering them as external avatars',
  },
  'link.logoExclusive': {
    zh: '媒体库图片和外部头像只能选择一种',
    en: 'Choose either a media library image or an external avatar, not both',
  },
  'link.applicationsClosed': {
    zh: '本站暂未开放友链申请',
    en: 'This site is not accepting friend link applications right now',
  },
  'link.applicationPending': {
    zh: '该地址已有一条待审核的申请，请耐心等待博主处理',
    en: 'An application for this URL is already awaiting review. Please wait for the blogger to handle it.',
    code: ErrorCode.Conflict,
  },
  'link.applicationListed': {
    zh: '该地址已在友链列表中，无需重复申请',
    en: 'This URL is already in the friend link list. There is no need to apply again.',
    code: ErrorCode.Conflict,
  },
  'link.applicationNotFound': { zh: '友链申请不存在', en: 'Friend link application not found' },
  'link.applicationHandled': {
    zh: '该申请已处理，请刷新后查看当前状态',
    en: 'This application has already been handled. Refresh to see its current state.',
    code: ErrorCode.Conflict,
  },
})
