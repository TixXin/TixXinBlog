/**
 * @file export.ts
 * @description 标签页数据导出：生成带版本号的 JSON，浏览器下载
 * @author TixXin
 * @since 2026-04-15
 */

import type { Bookmark, BookmarkCategory } from './types'
import type { TabSettings } from '~/composables/useTabSettings'

export interface TabExportFormat {
  version: 1
  exportedAt: string
  user?: { id: string; nickname?: string }
  categories: BookmarkCategory[]
  bookmarks: Bookmark[]
  settings?: TabSettings
}

/** 构造 JSON 字符串 */
export function buildExportJson(payload: TabExportFormat): string {
  return JSON.stringify(payload, null, 2)
}

/** 触发浏览器下载 */
export function triggerDownload(filename: string, content: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** 解析导入的 JSON，返回规范化数据；失败抛错 */
export function parseImportJson(raw: string): TabExportFormat {
  const obj = JSON.parse(raw) as Partial<TabExportFormat>
  if (!obj || typeof obj !== 'object') throw new Error('非法的 JSON 结构')
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.bookmarks)) {
    throw new Error('缺少 categories 或 bookmarks 字段')
  }
  return {
    version: 1,
    exportedAt: obj.exportedAt ?? new Date().toISOString(),
    user: obj.user,
    categories: obj.categories,
    bookmarks: obj.bookmarks,
    settings: obj.settings,
  }
}
