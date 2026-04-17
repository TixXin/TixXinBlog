/**
 * @file flash.json.ts
 * @description 闪念公开 JSON API，便于第三方聚合 / 静态站抓取（参考 Blinko-Hub 模式）
 * @author TixXin
 * @since 2026-04-17
 *
 * 数据源同 /flash.xml：server 端无法访问 localStorage，使用 defaultFlashNoteSeeds（博主公开 seed）。
 * 后端就绪后改为 $fetch /api/flash-notes?userId=owner&isArchived=false。
 */

import { defaultFlashNoteSeeds } from '~/features/flash/mock'

const SITE_URL = 'https://tix.xin'

export default defineEventHandler((event) => {
  const notes = defaultFlashNoteSeeds
    .slice()
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map((n) => ({
      id: n.id,
      url: `${SITE_URL}/flash/${n.id}`,
      content: n.content,
      tags: n.tags,
      type: n.type ?? 'memo',
      createdAt: n.createdAt,
      images: n.images ?? [],
      isPinned: !!n.isPinned,
    }))

  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'public, max-age=300')

  return {
    site: { name: 'TixXin Blog', url: SITE_URL },
    feed: { name: 'TixXin 闪念', url: `${SITE_URL}/flash` },
    generatedAt: new Date().toISOString(),
    count: notes.length,
    notes,
  }
})
