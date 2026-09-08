/**
 * @file urls.ts
 * @description 动态站点地图来源：只有当前公开文章，不收录草稿或归档文章
 */
import { publicMetadata } from '../../utils/publicContent'
import { articlePath } from '~/utils/articlePath'

export default defineEventHandler(async (event) => {
  const data = await publicMetadata(event)
  return data.archive.filter((post) => !post.seoNoindex).map((post) => ({ loc: articlePath(post), lastmod: post.date }))
})
