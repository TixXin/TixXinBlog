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
  // 站点资料修订原因：以中文持久化，历史列表按请求语言反查翻译
  'setup.reasonSiteProfile': { zh: '初始化向导设置站点资料', en: 'Site settings from the setup wizard' },
})
