/**
 * @file importFile.ts
 * @description 书签导入文件转为导入载荷：本站导出的 JSON 按分类名重新关联，其他文件按浏览器书签 HTML 解析；不沿用来源账号或记录 ID
 * @author TixXin
 * @since 2026-10-27
 */
import type { Translate } from '~/utils/format'
import type { ImportPayload } from './types'
import { parseImportJson } from './export'
import { parseNetscapeBookmarks } from './import-netscape'

export function importPayloadFromFile(fileName: string, raw: string, t: Translate): ImportPayload {
  if (!fileName.toLowerCase().endsWith('.json')) return parseNetscapeBookmarks(raw)
  const exp = parseImportJson(raw)
  return {
    categories: exp.categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color })),
    bookmarks: exp.bookmarks.map((b) => {
      const cat = exp.categories.find((c) => c.id === b.categoryId)
      return {
        categoryName: cat?.name ?? t('misc.tab.netscape.importedGroup'),
        name: b.name,
        url: b.url,
        icon: b.icon,
        color: b.color,
        description: b.description,
      }
    }),
  }
}
