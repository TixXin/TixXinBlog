/**
 * @file common.messages.ts
 * @description 通用守卫、装饰器、过滤器、健康检查与内容关联的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const commonMessages = defineMessages({
  'common.serverError': { zh: '服务端异常', en: 'Internal server error' },
  'common.visitorIdMissing': { zh: '缺少 X-Visitor-Id 请求头', en: 'Missing X-Visitor-Id header' },
  'common.visitorIdMalformed': { zh: 'X-Visitor-Id 格式错误', en: 'Malformed X-Visitor-Id header' },
  'common.unauthorized': { zh: '未鉴权', en: 'Not authenticated' },
  'common.bearerMissing': { zh: '未鉴权:缺少 Bearer token', en: 'Not authenticated: missing Bearer token' },
  'common.accessTokenExpired': { zh: 'Access token 已过期', en: 'Access token has expired' },
  'common.accessTokenInvalid': { zh: 'Access token 非法', en: 'Invalid access token' },
  'common.sessionCheckUnavailable': {
    zh: '登录状态暂时无法校验，请稍后重试',
    en: 'Your sign-in status cannot be verified right now. Please try again later.',
  },
  'common.sessionExpired': { zh: '会话已失效，请重新登录', en: 'Your session has expired. Please sign in again.' },
  'common.contentRestored': {
    zh: '站点数据已恢复，请保留输入并刷新页面后重新读取',
    en: 'Site data has been restored. Keep your input, then refresh the page to reload.',
    code: ErrorCode.ContentContextRestored,
  },
  'common.contentContextChangedEdit': {
    zh: '站点数据上下文已变化，请保留输入并刷新页面后再编辑',
    en: 'The site data context has changed. Keep your input and refresh the page before editing.',
    code: ErrorCode.ContentContextChanged,
  },
  'common.contentContextChangedSubmit': {
    zh: '站点数据上下文已变化，请保留输入并刷新页面后再提交',
    en: 'The site data context has changed. Keep your input and refresh the page before submitting.',
    code: ErrorCode.ContentContextChanged,
  },
  'common.crossSiteAuth': { zh: '不允许跨站认证操作', en: 'Cross-site authentication requests are not allowed' },
  'common.submissionRejected': {
    zh: '提交未完成，请稍后重试',
    en: 'Your submission could not be completed. Please try again later.',
  },
  'common.rateLimited': { zh: '操作过于频繁，请稍后重试', en: 'Too many requests. Please try again later.' },
  'common.shuttingDown': { zh: '服务正在关闭', en: 'The service is shutting down' },
  'common.databaseNotReady': { zh: '数据库尚未就绪', en: 'The database is not ready yet' },
  'common.relationsTooMany': {
    zh: '关联内容最多选择12项',
    en: 'You can select up to 12 related items',
  },
  'common.relationInvalid': { zh: '关联内容类型或编号不合法', en: 'Invalid related content type or ID' },
  // 关联目标缺失时的兜底标题
  'common.relationFallbackTitle': { zh: '内容 #{id}', en: 'Content #{id}' },
  'common.relationSelf': { zh: '内容不能关联自身', en: 'Content cannot be related to itself' },
  'common.relationTargetMissing': {
    zh: '新关联目标不存在或已删除，请重新选择；原有失效关联可以保留或解除',
    en: 'The new related item does not exist or has been deleted. Choose again; existing broken relations can be kept or removed.',
  },
})
