/**
 * @file index.ts
 * @description web-blog 的本地主题契约入口，声明主题引擎可分发的逻辑组件名
 * @author TixXin
 * @since 2026-04-03
 */

export interface ThemeComponentContracts {
  RootLayout: Record<string, never>
  ThemeAccessory: Record<string, never>
}

export const themeContractNames = ['RootLayout', 'ThemeAccessory'] as const

export type ThemeContractName = typeof themeContractNames[number]
