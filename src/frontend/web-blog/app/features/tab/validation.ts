/**
 * @file validation.ts
 * @description 书签导入与写入边界：大小、数量、字段和 URL 协议校验
 */
import type { ImportPayload } from './types'
import { currentTranslate } from '~/utils/format'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_BOOKMARKS = 10000
export const MAX_CATEGORIES = 1000

/** 校验报错里引用的字段名，对应字典 misc.tab.validation.field.* */
export type TabValidationField =
  | 'categoryId'
  | 'categoryName'
  | 'categoryOwner'
  | 'categoryIcon'
  | 'bookmarkId'
  | 'bookmarkName'
  | 'bookmarkOwner'
  | 'bookmarkUrl'

/** 按调用时的界面语言生成校验错误；不在模块顶层固定文案 */
export function tabValidationError(key: string, params?: Record<string, unknown>): Error {
  return new Error(currentTranslate()(`misc.tab.validation.${key}`, params))
}

export function requireImportText(raw: string): void {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES)
    throw tabValidationError('fileTooLarge', { size: '5 MB' })
}

export function requireText(value: unknown, field: TabValidationField, max = 200): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw tabValidationError('fieldInvalid', { field: currentTranslate()(`misc.tab.validation.field.${field}`) })
  }
}

export function requireWebUrl(value: unknown): asserts value is string {
  requireText(value, 'bookmarkUrl', 2048)
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('protocol')
  } catch {
    throw tabValidationError('urlProtocol')
  }
}

export function validateImportPayload(data: ImportPayload): void {
  if (data.categories.length > MAX_CATEGORIES || data.bookmarks.length > MAX_BOOKMARKS) {
    throw tabValidationError('tooMany', { categories: MAX_CATEGORIES, bookmarks: MAX_BOOKMARKS })
  }
  const names = new Set<string>()
  for (const category of data.categories) {
    requireText(category?.name, 'categoryName')
    if (names.has(category.name)) throw tabValidationError('duplicateCategoryName')
    names.add(category.name)
  }
  for (const bookmark of data.bookmarks) {
    requireText(bookmark?.name, 'bookmarkName')
    requireWebUrl(bookmark.url)
    if (!names.has(bookmark.categoryName)) throw tabValidationError('unknownCategory')
    if (
      bookmark.description !== undefined &&
      (typeof bookmark.description !== 'string' || bookmark.description.length > 2000)
    ) {
      throw tabValidationError('descriptionInvalid')
    }
  }
}
