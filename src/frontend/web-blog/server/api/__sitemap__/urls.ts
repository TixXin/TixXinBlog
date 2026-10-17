/**
 * @file urls.ts
 * @description 动态站点地图来源：公开文章、闪念详情、朋友圈详情与话题页，不收录草稿、归档或 noindex 内容。
 * lastmod 只写入接口能提供的时间：文章沿用发布日期，闪念用 updatedAt，朋友圈与话题暂无更新时间则不写。
 */
import type { FlashNote } from '~/features/flash/types'
import type { MomentItem, MomentOverview } from '~/features/moment/types'
import { publicApi, publicMetadata, publicPagedItems } from '../../utils/publicContent'
import { articlePath } from '~/utils/articlePath'

export default defineEventHandler(async (event) => {
  // 文章是核心来源，读取失败时整体失败；其余来源失败时跳过，不让单一领域拖垮站点地图
  const [data, flashes, moments, overview] = await Promise.all([
    publicMetadata(event),
    publicPagedItems<FlashNote>(event, '/flashes', 100).catch(() => []),
    publicPagedItems<MomentItem>(event, '/moments?pinnedFirst=false', 50).catch(() => []),
    publicApi<MomentOverview>(event, '/moments/overview').catch(() => null),
  ])
  return [
    ...data.archive.filter((post) => !post.seoNoindex).map((post) => ({ loc: articlePath(post), lastmod: post.date })),
    ...flashes
      .filter((note) => !note.isDraft && !note.isArchived)
      .map((note) => ({ loc: `/flash/${note.id}`, lastmod: note.updatedAt || note.createdAt })),
    ...moments.map((moment) => ({ loc: `/moments/${moment.id}` })),
    // 站点地图模块会自行编码 loc，这里传原始路径；含路径分隔或查询保留字符的话题无法安全表示，跳过
    ...(overview?.topics ?? [])
      .filter((topic) => !/[/?#%]/.test(topic.name))
      .map((topic) => ({ loc: `/moments/topic/${topic.name}` })),
  ]
})
