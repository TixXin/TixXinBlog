/**
 * @file variants.mjs
 * @description 静态发布录制时访问的页面状态：分页、归档年月、图库分类与照片、项目进展标签与详情、友链推荐、
 *   提示词模型标签与详情、订阅币种、朋友圈与留言日期。取值全部来自真实接口，参数名与各页 query 规范化函数一致。
 *   未枚举到的组合由浏览器在列表全量上过滤（app/features/static/textQuery.ts）。
 */
import { categoryPath, readAll, tagPath } from './routes.mjs'

const pages = (total, size) => Math.max(1, Math.ceil(total / size))
function paged(path, total, size, extra = '') {
  const urls = []
  for (let page = 2; page <= pages(total, size); page += 1) urls.push(`${path}?${extra ? `${extra}&` : ''}page=${page}`)
  return urls
}
const query = (path, values) => `${path}?${new URLSearchParams(values)}`

export async function staticVariants(read) {
  const [posts, metadata, gallery, galleryMeta, projects, projectMeta, links, prompts, promptMeta, stats, moments] =
    await Promise.all([
      read('/posts?page=1&pageSize=15'),
      read('/posts/metadata'),
      readAll(read, '/gallery', 12),
      read('/gallery/metadata'),
      readAll(read, '/projects', 12),
      read('/projects/metadata'),
      read('/links/metadata'),
      readAll(read, '/prompts', 12),
      read('/prompts/metadata'),
      read('/subscriptions/stats'),
      read('/moments/overview'),
    ])
  const guestbook = await readAll(read, '/guestbook', 12)
  const urls = new Set(paged('/', posts.total, 15))
  for (const tag of metadata.tags ?? []) for (const url of paged(tagPath(tag.label), tag.count, 15)) urls.add(url)
  for (const category of metadata.categories ?? [])
    for (const url of paged(categoryPath(category.name), category.count, 15)) urls.add(url)
  // 归档：年、年月，以及超过一页时的分页
  const months = new Map()
  for (const post of metadata.archive ?? []) {
    const [year, month] = String(post.date).slice(0, 7).split('-').map(Number)
    months.set(`${year}`, (months.get(`${year}`) ?? 0) + 1)
    months.set(`${year}-${month}`, (months.get(`${year}-${month}`) ?? 0) + 1)
  }
  urls.add('/archive?page=2')
  for (const [key, count] of months) {
    const [year, month] = key.split('-')
    const extra = new URLSearchParams(month ? { year, month } : { year }).toString()
    urls.add(`/archive?${extra}`)
    for (const url of paged('/archive', count, 50, extra)) urls.add(url)
  }
  for (const url of paged('/gallery', gallery.length, 12)) urls.add(url)
  for (const category of galleryMeta.categories ?? []) urls.add(query('/gallery', { category: category.value }))
  for (const photo of gallery) urls.add(query('/gallery', { photo: photo.id }))
  for (const url of paged('/projects', projects.length, 12)) urls.add(url)
  for (const progress of ['active', 'dev', 'archived']) urls.add(query('/projects', { progress }))
  for (const tag of projectMeta.tags ?? []) urls.add(query('/projects', { tag: tag.label }))
  for (const project of projects) urls.add(query('/projects', { project: project.id }))
  for (const url of paged('/links', links.stats?.links ?? 0, 12)) urls.add(url)
  for (const featured of ['true', 'false']) urls.add(query('/links', { featured }))
  for (const url of paged('/prompts', prompts.length, 12)) urls.add(url)
  for (const model of promptMeta.models ?? []) urls.add(query('/prompts', { model: model.label }))
  for (const tag of promptMeta.tags ?? []) urls.add(query('/prompts', { tag: tag.label }))
  for (const prompt of prompts) urls.add(query('/prompts', { prompt: prompt.id }))
  for (const currency of stats.currencies ?? []) urls.add(query('/subscriptions', { currency: currency.currency }))
  for (const day of moments.dates ?? []) urls.add(query('/moments', { date: day.date }))
  for (const topic of moments.topics ?? []) urls.add(query('/moments', { topic: topic.name }))
  for (const day of new Set(guestbook.map((message) => String(message.createdAt ?? '').slice(0, 10))))
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) urls.add(query('/guestbook', { date: day }))
  return [...urls]
}
