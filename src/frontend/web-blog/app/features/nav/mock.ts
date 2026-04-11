/**
 * @file mock.ts
 * @description 导航模块 mock 数据，提供侧边栏和移动端导航项
 * @author TixXin
 * @since 2025-03-17
 */

import type { NavItem } from './types'

export const mockNavItems: NavItem[] = [
  { icon: 'lucide:home', label: '主页', to: '/' },
  { icon: 'lucide:archive', label: '归档', to: '/archive' },
  { icon: 'lucide:layers', label: '项目', to: '/projects' },
  { icon: 'lucide:image', label: '画廊', to: '/gallery' },
  { icon: 'lucide:link', label: '友链', to: '/links', desktopOnly: true },
  { icon: 'lucide:message-circle', label: '留言', to: '/guestbook' },
  { icon: 'lucide:user', label: '关于', to: '/about' },
]
