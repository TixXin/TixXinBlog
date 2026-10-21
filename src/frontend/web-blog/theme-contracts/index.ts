/**
 * @file index.ts
 * @description web-blog 的本地主题契约入口，声明主题引擎可分发的逻辑组件名
 * @author TixXin
 * @since 2026-04-03
 */

import type { PostItem } from '~/features/post/types'

/**
 * PostCard 的真实属性：必须与宿主 PostCardList 实际传入的一致，
 * 否则空 Props 会掩盖主题实现与调用方的类型漂移。
 */
export interface PostCardContractProps {
  post: PostItem
  /** 首屏前两张卡片按高优先级加载 */
  priority?: boolean
}

export interface ThemeComponentContracts {
  RootLayout: Record<string, never>
  ThemeAccessory: Record<string, never>
  StatusFooter: Record<string, never>
  PostCard: PostCardContractProps
}

// 引擎的 DTS 生成用正则读取这段字面量，保持 `[...] as const` 格式，不要改写为变量拼接。
export const themeContractNames = ['RootLayout', 'ThemeAccessory', 'StatusFooter', 'PostCard'] as const

export type ThemeContractName = (typeof themeContractNames)[number]
