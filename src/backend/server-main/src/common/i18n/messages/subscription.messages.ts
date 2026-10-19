/**
 * @file subscription.messages.ts
 * @description 博主平台订阅的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const subscriptionMessages = defineMessages({
  'subscription.idInvalid': { zh: '订阅编号不合法', en: 'Invalid subscription ID' },
  'subscription.urlMalformed': {
    zh: '官网地址不能包含空白、控制字符或反斜杠',
    en: 'The website URL cannot contain whitespace, control characters, or backslashes',
  },
  'subscription.urlInvalid': {
    zh: '官网需要标准 HTTP(S) 地址，不能带凭据或非标准端口',
    en: 'The website must be a standard HTTP(S) URL without credentials or a non-standard port',
  },
  'subscription.faviconDomainInvalid': {
    zh: '自动图标需要公开网站域名',
    en: 'Automatic icons require a public website domain',
  },
  'subscription.dateInvalid': {
    zh: '请输入真实的 YYYY-MM-DD 日期',
    en: 'Please enter a real date in YYYY-MM-DD format',
  },
  'subscription.nextBillingBeforeStart': {
    zh: '下次扣费日期不能早于订阅开始日期',
    en: 'The next billing date cannot be earlier than the subscription start date',
  },
  'subscription.notFoundOrUnpublished': {
    zh: '订阅不存在或尚未公开',
    en: 'Subscription not found or not yet published',
  },
  'subscription.submissionNotFound': {
    zh: '尚未找到此提交，请使用原提交标识重试',
    en: 'This submission was not found yet. Please retry with the original submission ID.',
  },
  'subscription.createRequiresFields': {
    zh: '创建需要名称、金额、币种、周期及唯一提交标识，不能携带编辑版本',
    en: 'Creating requires a name, amount, currency, billing cycle, and unique submission ID, and cannot include an edit revision.',
  },
  'subscription.editRequiresRevision': {
    zh: '编辑需要当前版本，不能携带创建标识',
    en: 'Editing requires the current revision and cannot include a creation ID.',
  },
  'subscription.submissionConflict': {
    zh: '此提交已处理，请核查原订阅',
    en: 'This submission has already been processed. Please check the original subscription.',
    code: ErrorCode.SubmissionConflict,
  },
  'subscription.iconMediaInvalid': {
    zh: '请选择有效的媒体库图标',
    en: 'Please select a valid icon from the media library',
  },
  'subscription.notFoundOrDeleted': { zh: '订阅不存在或已删除', en: 'Subscription not found or deleted' },
  'subscription.revisionConflict': {
    zh: '订阅已被修改，请保留输入并重新读取',
    en: 'This subscription has been modified. Keep your input and reload it.',
    code: ErrorCode.RevisionConflict,
  },
  'subscription.priceHistoryConflict': {
    zh: '价格历史与当前时间或价格不一致，请保留输入，核对服务器时钟与历史后重试',
    en: 'The price history does not match the current time or price. Keep your input, check the server clock and history, then try again.',
  },
  'subscription.notFound': { zh: '订阅不存在', en: 'Subscription not found' },
  'subscription.changed': {
    zh: '订阅已变化，请重新读取',
    en: 'This subscription has changed. Please reload it.',
    code: ErrorCode.RevisionConflict,
  },
  'subscription.changedBeforeDelete': {
    zh: '订阅已变化，请重新读取后确认删除',
    en: 'This subscription has changed. Reload it, then confirm the deletion.',
    code: ErrorCode.RevisionConflict,
  },
  'subscription.sortDuplicate': { zh: '排序条目不能重复', en: 'Sort entries cannot be duplicated' },
  'subscription.someNotFound': {
    zh: '部分订阅不存在或已删除',
    en: 'Some subscriptions do not exist or have been deleted',
  },
  'subscription.changedBeforeSort': {
    zh: '订阅已被修改，请重新读取后排序',
    en: 'Subscriptions have been modified. Reload them before sorting.',
    code: ErrorCode.RevisionConflict,
  },
  'subscription.faviconCacheNotFound': { zh: '图标缓存不存在', en: 'Icon cache not found' },
})
