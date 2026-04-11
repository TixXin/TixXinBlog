/**
 * @file mock.ts
 * @description 认证模块 mock 数据：默认访客用户与登录态切换示例
 * @author TixXin
 * @since 2026-04-11
 */

import type { CurrentUser } from './types'

/** mock 普通访客（登录后展示的样例用户） */
export const mockVisitorUser: CurrentUser = {
  id: 'visitor-001',
  nickname: '路过的旅人',
  email: 'traveler@example.com',
  avatar:
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=200&q=80',
  role: 'visitor',
  signature: '保持好奇，温柔以待',
}
