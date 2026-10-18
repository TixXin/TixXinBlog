/**
 * @file urls.ts
 * @description 动态站点地图来源：公开文章及其标签和专栏、闪念详情、朋友圈详情与话题页，不收录草稿、归档或 noindex 文章。
 * lastmod 只写入接口能提供的时间：文章用内容修订时间 updatedAt（旧接口缺省时回退发布日期），闪念用 updatedAt，
 * 标签、专栏、朋友圈与话题暂无更新时间则不写。
 */
import type { FlashNote } from '~/features/flash/types'
import type { MomentItem, MomentOverview } from '~/features/moment/types'
import { publicApi, publicMetadata, publicPagedItems } from '../../utils/publicContent'
import { articlePath } from '~/utils/articlePath'
import { postCategoryPath, postTagPath } from '~/features/post/taxonomy'

export default defineEventHandler(async (event) => {
  // 文章是核心来源，读取失败时整体失败；其余来源失败时跳过，不让单一领域拖垮站点地图
  const [data, flashes, moments, overview] = await Promise.all([
    publicMetadata(event),
    publicPagedItems<FlashNote>(event, '/flashes', 100).catch(() => []),
    publicPagedItems<MomentItem>(event, '/moments?pinnedFirst=false', 50).catch(() => []),
    publicApi<MomentOverview>(event, '/moments/overview').catch(() => null),
  ])
  return [
    ...data.archive
      .filter((post) => !post.seoNoindex)
      .map((post) => ({ loc: articlePath(post), lastmod: post.updatedAt || post.date })),
    // 路径段已由共用规则编码；告诉站点地图保留编码，避免中文和保留字符被二次编码。
    // 旧接口或部分降级响应可能缺少目录字段，按空目录处理，不让标签与专栏拖垮整个站点地图。
    ...(data.tags ?? []).filter((tag) => tag.count > 0).map((tag) => ({ loc: postTagPath(tag.label), _encoded: true })),
    ...(data.categories ?? [])
      .filter((category) => category.count > 0)
      .map((category) => ({ loc: postCategoryPath(category.name), _encoded: true })),
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
