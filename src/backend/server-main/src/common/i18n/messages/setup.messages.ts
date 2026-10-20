/**
 * @file setup.messages.ts
 * @description 浏览器初始化向导的中英文案：令牌、密码规则、并发冲突与站点资料修订原因
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

export const setupMessages = defineMessages({
  'setup.tokenInvalid': {
    zh: '初始化令牌无效，请核对安装完成时输出的链接',
    en: 'The setup token is invalid. Check the link printed when installation finished.',
  },
  'setup.usernameInvalid': {
    zh: '登录名需为 1–64 个字符',
    en: 'The username must be 1–64 characters',
  },
  'setup.passwordMissing': { zh: '请填写密码', en: 'Enter a password' },
  'setup.passwordTooShort': {
    zh: '密码至少需要 {min} 个字符',
    en: 'The password must be at least {min} characters',
  },
  'setup.passwordTooLong': {
    zh: '密码不能超过 {max} 个字符',
    en: 'The password cannot exceed {max} characters',
  },
  'setup.alreadyCompleted': {
    zh: '站点已完成初始化，请直接登录后台',
    en: 'This site has already been set up. Sign in to the dashboard instead.',
  },
  'setup.launchedAtInvalid': { zh: '建站日期需为 YYYY-MM-DD', en: 'The launch date must be YYYY-MM-DD' },
  'setup.emailInvalid': { zh: '请填写有效的邮箱地址', en: 'Enter a valid email address' },
  'setup.avatarTooLarge': {
    zh: '头像图片过大，请换一张较小的图片',
    en: 'The avatar image is too large. Choose a smaller image.',
  },
  'setup.avatarInvalid': {
    zh: '头像图片无法读取，请换一张图片',
    en: 'The avatar image cannot be read. Choose another image.',
  },
  'setup.avatarUrlInvalid': {
    zh: '头像地址需为 http(s) 图片链接',
    en: 'The avatar address must be an http(s) image link',
  },
  'setup.avatarEmailRequired': {
    zh: '使用 Cravatar 头像需要先填写联系邮箱',
    en: 'Enter a contact email to use a Cravatar avatar',
  },
  'setup.socialUrlInvalid': {
    zh: '社交链接需为 http(s) 地址',
    en: 'Social links must be http(s) addresses',
  },
  // 头像登记为站内媒体时的图片说明，以中文持久化
  'setup.avatarAlt': { zh: '博主头像', en: 'Owner avatar' },
  // 审计中的字段名以中文持久化；建站日期在通用审计字段表中没有对应项
  'setup.fieldLaunchedAt': { zh: '建站日期', en: 'Launch date' },
  // 站点资料修订原因：以中文持久化，历史列表按请求语言反查翻译
  'setup.reasonSiteProfile': { zh: '初始化向导设置站点资料', en: 'Site settings from the setup wizard' },
})
