/**
 * @file validation.ts
 * @description 书签导入与写入边界：大小、数量、字段和 URL 协议校验
 */
import type { ImportPayload } from './types'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_BOOKMARKS = 10000
export const MAX_CATEGORIES = 1000

export function requireImportText(raw: string): void {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) throw new Error('导入文件不能超过 5 MB')
}

export function requireText(value: unknown, name: string, max = 200): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name}格式不正确`)
}

export function requireWebUrl(value: unknown): asserts value is string {
  requireText(value, '书签地址', 2048)
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('protocol')
  } catch {
    throw new Error('书签地址只允许不含账号密码的 HTTP 或 HTTPS 地址')
  }
}

export function validateImportPayload(data: ImportPayload): void {
  if (data.categories.length > MAX_CATEGORIES || data.bookmarks.length > MAX_BOOKMARKS) {
    throw new Error('导入最多支持 1000 个分类和 10000 个书签')
  }
  const names = new Set<string>()
  for (const category of data.categories) {
    requireText(category?.name, '分类名称')
    if (names.has(category.name)) throw new Error('导入文件包含重复的分类名称')
    names.add(category.name)
  }
  for (const bookmark of data.bookmarks) {
    requireText(bookmark?.name, '书签名称')
    requireWebUrl(bookmark.url)
    if (!names.has(bookmark.categoryName)) throw new Error('书签引用了不存在的分类')
    if (
      bookmark.description !== undefined &&
      (typeof bookmark.description !== 'string' || bookmark.description.length > 2000)
    ) {
      throw new Error('书签描述格式不正确')
    }
  }
}
