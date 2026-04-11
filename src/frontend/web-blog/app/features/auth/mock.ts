/**
 * @file mock.ts
 * @description 认证模块 mock 数据：测试账号清单 + 默认访客用户 + 查询助手
 * @author TixXin
 * @since 2026-04-11
 *
 * 测试账号（mock 阶段，UI 不暴露；后端接入后整体替换）：
 * - 博主：admin@tixxin.dev / admin123    → role: owner
 * - 访客：visitor@tixxin.dev / visitor123 → role: visitor
 *
 * 注册表单当前为"注册即登录"占位，新邮箱不会写回清单，刷新即丢。
 */

import type { CurrentUser } from './types'

/** mock 博主用户（owner 角色，对应 mockOwnerCard 身份） */
export const mockOwnerUser: CurrentUser = {
  id: 'owner-001',
  nickname: 'TixXin',
  email: 'admin@tixxin.dev',
  // 与 StatusFooter 浮动头像保持一致
  avatar:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12',
  role: 'owner',
  signature: '独立开发者 / 折腾爱好者',
}

/** mock 普通访客（visitor 角色，登录后展示的样例用户） */
export const mockVisitorUser: CurrentUser = {
  id: 'visitor-001',
  nickname: '路过的旅人',
  email: 'visitor@tixxin.dev',
  avatar:
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=200&q=80',
  role: 'visitor',
  signature: '保持好奇，温柔以待',
}

/** mock 测试账号条目 */
export interface MockAuthAccount {
  email: string
  password: string
  user: CurrentUser
}

/** mock 测试账号清单（登录表单按此清单做凭据校验） */
export const mockAuthAccounts: MockAuthAccount[] = [
  { email: 'admin@tixxin.dev', password: 'admin123', user: mockOwnerUser },
  { email: 'visitor@tixxin.dev', password: 'visitor123', user: mockVisitorUser },
]

/**
 * 在 mock 账号清单中查找匹配的凭据。
 * 邮箱做 trim + 小写归一化，密码区分大小写按原样比对。
 * 命中返回拷贝（避免外部 mutation 污染 mock 源），未命中返回 null。
 */
export function findMockAccount(email: string, password: string): CurrentUser | null {
  const normalized = email.trim().toLowerCase()
  const hit = mockAuthAccounts.find(
    (account) => account.email.toLowerCase() === normalized && account.password === password,
  )
  return hit ? { ...hit.user } : null
}
