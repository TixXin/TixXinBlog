/**
 * @file preview.ts
 * @description Dev 预览配置与路由参数映射纯逻辑
 * @author TixXin
 * @since 2026-10-21
 */

import type { PreviewEntry, PreviewGroup } from './types'

export const PREVIEW_KEYS: readonly string[] = ['preview', 'preview-submit'] as const

export const PREVIEW_GROUPS: readonly PreviewGroup[] = [
  {
    label: '初始化页 /setup',
    items: [
      { label: '表单', icon: 'lucide:file-pen', path: '/setup', query: { preview: 'form' } },
      {
        label: '表单（模拟提交失败）',
        icon: 'lucide:file-x',
        path: '/setup',
        query: { preview: 'form', 'preview-submit': 'fail' },
      },
      { label: '已完成初始化', icon: 'lucide:circle-check', path: '/setup', query: { preview: 'closed' } },
      { label: '状态读取失败', icon: 'lucide:circle-alert', path: '/setup', query: { preview: 'error' } },
    ],
  },
  {
    label: '未初始化引导',
    items: [
      { label: '首页提示', icon: 'lucide:house', path: '/', query: { preview: 'setup-pending' } },
      { label: '登录页引导', icon: 'lucide:log-in', path: '/admin/login', query: { preview: 'setup-pending' } },
    ],
  },
] as const

/** 提取当前 URL 中激活的预览标记文本 */
export function formatActivePreview(query: Record<string, unknown>): string {
  return PREVIEW_KEYS.map((key) => query[key])
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .join(' · ')
}

/** 判断给定的预览条目是否与当前路由匹配 */
export function isPreviewActive(
  currentPath: string,
  currentQuery: Record<string, unknown>,
  item: PreviewEntry,
): boolean {
  return currentPath === item.path && PREVIEW_KEYS.every((key) => (currentQuery[key] ?? undefined) === item.query[key])
}

/** 生成激活指定预览项的路由目标配置 */
export function createPreviewNavigation(
  currentPath: string,
  currentQuery: Record<string, unknown>,
  item: PreviewEntry,
): { path: string; query: Record<string, string> } {
  const rest = Object.fromEntries(
    Object.entries(currentQuery).filter(([key, val]) => !PREVIEW_KEYS.includes(key) && typeof val === 'string') as [
      string,
      string,
    ][],
  )
  return {
    path: item.path,
    query: currentPath === item.path ? { ...rest, ...item.query } : item.query,
  }
}

/** 生成退出当前预览的路由目标配置 */
export function createExitPreviewNavigation(
  currentPath: string,
  currentQuery: Record<string, unknown>,
  hash?: string,
): { path: string; query: Record<string, string>; hash?: string } {
  const rest = Object.fromEntries(
    Object.entries(currentQuery).filter(([key, val]) => !PREVIEW_KEYS.includes(key) && typeof val === 'string') as [
      string,
      string,
    ][],
  )
  return {
    path: currentPath,
    query: rest,
    hash,
  }
}
