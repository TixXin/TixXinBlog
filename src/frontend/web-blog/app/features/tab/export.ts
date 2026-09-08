/**
 * @file export.ts
 * @description 标签页数据导出：生成带版本号的 JSON，浏览器下载
 * @author TixXin
 * @since 2026-04-15
 */

import type { Bookmark, BookmarkCategory } from './types'
import type { TabSettings } from '~/composables/useTabSettings'
import { MAX_BOOKMARKS, MAX_CATEGORIES, requireImportText, requireText, requireWebUrl } from './validation'

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
  requireImportText(raw)
  const obj = JSON.parse(raw) as Partial<TabExportFormat>
  if (!obj || typeof obj !== 'object') throw new Error('非法的 JSON 结构')
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.bookmarks)) {
    throw new Error('缺少 categories 或 bookmarks 字段')
  }
  if (obj.version !== 1) throw new Error('不支持此导出格式版本')
  if (obj.categories.length > MAX_CATEGORIES || obj.bookmarks.length > MAX_BOOKMARKS) {
    throw new Error('导入最多支持 1000 个分类和 10000 个书签')
  }
  const categoryIds = new Set<string>()
  const categoryNames = new Set<string>()
  for (const category of obj.categories) {
    requireText(category?.id, '分类 ID', 128)
    requireText(category.name, '分类名称')
    requireText(category.userId, '分类所有者', 128)
    requireText(category.icon, '分类图标', 128)
    if (typeof category.color !== 'string' || category.color.length > 64 || !Number.isSafeInteger(category.sortOrder)) {
      throw new Error('分类颜色或排序字段不正确')
    }
    if (categoryIds.has(category.id) || categoryNames.has(category.name)) throw new Error('分类 ID 或名称重复')
    categoryIds.add(category.id)
    categoryNames.add(category.name)
  }
  const bookmarkIds = new Set<string>()
  for (const bookmark of obj.bookmarks) {
    requireText(bookmark?.id, '书签 ID', 128)
    requireText(bookmark.name, '书签名称')
    requireText(bookmark.userId, '书签所有者', 128)
    requireWebUrl(bookmark.url)
    if (!categoryIds.has(bookmark.categoryId) || !Number.isSafeInteger(bookmark.sortOrder))
      throw new Error('书签分类或排序字段不正确')
    if (bookmarkIds.has(bookmark.id)) throw new Error('书签 ID 重复')
    bookmarkIds.add(bookmark.id)
    if (
      bookmark.description !== undefined &&
      (typeof bookmark.description !== 'string' || bookmark.description.length > 2000)
    ) {
      throw new Error('书签描述格式不正确')
    }
    if (bookmark.icon !== undefined && (typeof bookmark.icon !== 'string' || bookmark.icon.length > 100000)) {
      throw new Error('书签图标格式不正确')
    }
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
