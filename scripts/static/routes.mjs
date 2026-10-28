/**
 * @file routes.mjs
 * @description 静态发布的预渲染地址清单：固定的公开页面与订阅源，加上从真实接口读取的文章、标签、专栏、闪念、朋友圈与话题地址。
 *   地址规则与 app/utils/articlePath.ts、app/features/post/taxonomy.ts 一致；只读取公开接口，不含 /admin、/setup、/posts/preview。
 */

/** 不依赖数据的公开页面；带查询参数的状态（分页、筛选、详情弹层）共用同一份 HTML，由冻结接口在浏览器内取数 */
export const STATIC_PAGES = [
  '/',
  '/archive',
  '/about',
  '/flash',
  '/moments',
  '/gallery',
  '/projects',
  '/links',
  '/prompts',
  '/guestbook',
  '/subscriptions',
  '/search',
  '/tabs',
]
/** 订阅源、站点地图与 robots，由 Nitro 路由在构建时生成 */
export const STATIC_FEEDS = [
  '/rss.xml',
  '/atom.xml',
  '/feed.json',
  '/flash.xml',
  '/moments.xml',
  '/api/flash.json',
  '/api/moments.json',
  '/sitemap.xml',
  '/robots.txt',
]

export const articlePath = (post) => `/articles/${encodeURIComponent(post.slug || String(post.id))}`
export const tagPath = (name) => `/tags/${encodeURIComponent(name)}`
export const categoryPath = (name) => `/categories/${encodeURIComponent(name)}`

/** 读取一个公开接口；任何失败都让整次构建失败，不生成缺页的站点 */
export function createApiReader(api, fetchImpl = fetch) {
  const base = api.replace(/\/$/, '')
  return async function read(path) {
    const response = await fetchImpl(`${base}${path}`, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`读取 ${path} 失败：HTTP ${response.status}`)
    const body = await response.json()
    if (body.code !== 0) throw new Error(`读取 ${path} 失败：${body.message ?? body.code}`)
    return body.data
  }
}

/** 用游标（before）而非页码分页的公开列表 */
export const CURSOR_LISTS = new Set(['/guestbook'])

/** 读取列表的一页：页码列表用 page，游标列表用上一页返回的 nextCursor */
export function listPagePath(path, pageSize, page, cursor) {
  const separator = path.includes('?') ? '&' : '?'
  if (!CURSOR_LISTS.has(path.split('?')[0])) return `${path}${separator}page=${page}&pageSize=${pageSize}`
  return `${path}${separator}pageSize=${pageSize}${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`
}

/** 逐页取尽列表，直到条数达到 total、返回不足一页或游标结束 */
export async function readAll(read, path, pageSize) {
  const items = []
  let cursor
  for (let page = 1; page <= 1000; page += 1) {
    const data = await read(listPagePath(path, pageSize, page, cursor))
    items.push(...data.items)
    cursor = data.nextCursor
    if (data.items.length < pageSize || items.length >= data.total || data.nextCursor === null) return items
  }
  throw new Error(`${path} 分页超过 1000 页，已停止`)
}

export async function staticRoutes(read) {
  const [metadata, flashes, moments, overview] = await Promise.all([
    read('/posts/metadata'),
    readAll(read, '/flashes', 50),
    readAll(read, '/moments?pinnedFirst=false', 50),
    read('/moments/overview'),
  ])
  const routes = new Set([...STATIC_PAGES, ...STATIC_FEEDS])
  for (const post of metadata.archive ?? []) routes.add(articlePath(post))
  for (const tag of metadata.tags ?? []) if (tag.count > 0) routes.add(tagPath(tag.label))
  for (const category of metadata.categories ?? []) if (category.count > 0) routes.add(categoryPath(category.name))
  for (const note of flashes) if (!note.isDraft && !note.isArchived) routes.add(`/flash/${note.id}`)
  for (const moment of moments) routes.add(`/moments/${moment.id}`)
  // 含路径分隔或查询保留字符的话题无法作为单独路径，与站点地图一致跳过
  for (const topic of overview?.topics ?? [])
    if (!/[/?#%]/.test(topic.name)) routes.add(`/moments/topic/${encodeURIComponent(topic.name)}`)
  return [...routes]
}
