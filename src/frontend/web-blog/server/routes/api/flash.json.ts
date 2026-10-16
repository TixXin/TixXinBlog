/**
 * @file flash.json.ts
 * @description 公开闪念 JSON 与 RSS 共用同一查询与公开过滤规则
 */
import { publicFlashes, publicSiteSettings, publicSiteUrl } from '../../utils/publicContent'

export default defineEventHandler(async (event) => {
  const site = publicSiteUrl(event)
  // 站点名取自博主维护的站点资料，与 RSS 保持同一来源
  const [notes, settings] = await Promise.all([publicFlashes(event), publicSiteSettings(event)])
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    site: { name: settings.name, url: site },
    feed: { name: `${settings.name} 闪念`, url: `${site}/flash` },
    generatedAt: new Date().toISOString(),
    count: notes.length,
    notes: notes.map((note) => ({ ...note, url: `${site}/flash/${encodeURIComponent(note.id)}` })),
  }
})
