/**
 * @file auth.messages.ts
 * @description 认证、会话与账号的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

export const authMessages = defineMessages({
  'auth.invalidCredentials': { zh: '用户名或密码错误', en: 'Incorrect username or password' },
  'auth.credentialsChanged': {
    zh: '账号凭据已变化，请重新登录',
    en: 'Your account credentials have changed. Please sign in again.',
  },
  'auth.loginExpired': { zh: '登录已失效', en: 'Your sign-in has expired' },
  'auth.accountNotFound': { zh: '账号不存在', en: 'Account not found' },
  'auth.refreshTokenInvalid': {
    zh: 'Refresh token 失效,请重新登录',
    en: 'Refresh token is invalid. Please sign in again.',
  },
  'auth.sessionRevokedOrExpired': {
    zh: '会话已撤销或过期，请重新登录',
    en: 'This session has been revoked or has expired. Please sign in again.',
  },
  'auth.loginExpiredRelogin': {
    zh: '登录已失效，请重新登录',
    en: 'Your sign-in has expired. Please sign in again.',
  },
  'auth.currentPasswordIncorrect': { zh: '当前密码不正确', en: 'The current password is incorrect' },
  'auth.newPasswordSame': {
    zh: '新密码不能与当前密码相同',
    en: 'The new password must differ from the current password',
  },
  'auth.currentSessionInvalid': { zh: '当前会话已失效', en: 'The current session is no longer valid' },
  'auth.sessionNotFound': { zh: '会话不存在', en: 'Session not found' },
  // 设备名片段：会话的 deviceLabel 以中文持久化，列表接口按请求语言逐段翻译。
  'auth.unknownSystem': { zh: '未知系统', en: 'Unknown OS' },
  'auth.unknownClient': { zh: '未知客户端', en: 'Unknown client' },
})
