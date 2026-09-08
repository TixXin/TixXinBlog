/**
 * @file mock.ts
 * @description 旧展示域的示例身份；不含登录凭据，不用于管理员认证
 */

import type { CurrentUser } from './types'

/** mock 博主用户（owner 角色，对应 mockOwnerCard 身份） */
export const mockOwnerUser: CurrentUser = {
  id: 'owner-001',
  nickname: 'TixXin',
  email: 'admin@tixxin.dev',
  // 与 StatusFooter 浮动头像保持一致
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80&sat=-12',
  role: 'owner',
  signature: '独立开发者 / 折腾爱好者',
}

/** mock 普通访客（visitor 角色，登录后展示的样例用户） */
export const mockVisitorUser: CurrentUser = {
  id: 'visitor-001',
  nickname: '路过的旅人',
  email: 'visitor@tixxin.dev',
  avatar: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=200&q=80',
  role: 'visitor',
  signature: '保持好奇，温柔以待',
}
