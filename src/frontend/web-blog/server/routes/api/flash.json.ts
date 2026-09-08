/**
 * @file flash.json.ts
 * @description 公开闪念 JSON 与 RSS 共用同一查询与公开过滤规则
 */
import { publicFlashes, publicSiteUrl } from '../../utils/publicContent'

export default defineEventHandler(async (event) => {
  const site = publicSiteUrl(event)
  const notes = await publicFlashes(event)
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    site: { name: 'TixXin Blog', url: site },
    feed: { name: 'TixXin 闪念', url: `${site}/flash` },
    generatedAt: new Date().toISOString(),
    count: notes.length,
    notes: notes.map((note) => ({ ...note, url: `${site}/flash/${encodeURIComponent(note.id)}` })),
  }
})
