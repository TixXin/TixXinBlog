/**
 * @file import-netscape.ts
 * @description 解析浏览器导出的 Netscape Bookmark File (HTML) 格式
 * @author TixXin
 * @since 2026-04-15
 *
 * 格式说明：
 * - 根 <DL> 包含多个 <DT>
 * - <DT><H3>xxx</H3> 表示分类，紧跟一个子 <DL>
 * - <DT><A HREF="...">xxx</A> 表示书签，可选 ICON / ICON_URI 属性
 * - Chrome/Firefox/Edge 导出都兼容此格式
 */

import type { ImportPayload } from './types'

export function parseNetscapeBookmarks(html: string): ImportPayload {
  if (typeof window === 'undefined') {
    throw new Error('Netscape 书签解析需在浏览器端执行')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('DL')
  if (!root) throw new Error('未找到 <DL> 根节点，可能不是有效的书签文件')

  const categories: ImportPayload['categories'] = []
  const bookmarks: ImportPayload['bookmarks'] = []
  const categoryNames = new Set<string>()

  function ensureCategory(name: string): string {
    if (!categoryNames.has(name)) {
      categoryNames.add(name)
      categories.push({ name, icon: 'lucide:folder', color: '' })
    }
    return name
  }

  function walk(dl: Element, currentCategory: string) {
    // 直接子 DT 节点
    for (const child of Array.from(dl.children)) {
      if (child.tagName !== 'DT') continue
      const h3 = child.querySelector(':scope > H3')
      const a = child.querySelector(':scope > A')
      if (h3) {
        const name = h3.textContent?.trim() || '未命名分组'
        ensureCategory(name)
        const subDl = child.querySelector(':scope > DL')
        if (subDl) walk(subDl, name)
      } else if (a) {
        const href = a.getAttribute('HREF') ?? a.getAttribute('href') ?? ''
        if (!href) continue
        const bmName = a.textContent?.trim() || href
        const icon = a.getAttribute('ICON') ?? a.getAttribute('icon') ?? undefined
        bookmarks.push({
          categoryName: currentCategory,
          name: bmName,
          url: href,
          icon: icon?.startsWith('data:') ? icon : undefined,
        })
      }
    }
  }

  // 默认分类：没被归入分组的顶层书签
  ensureCategory('导入')
  walk(root, '导入')

  return { categories, bookmarks }
}
