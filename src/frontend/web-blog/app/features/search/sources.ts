/**
 * @file sources.ts
 * @description 六域公开检索的分来源读取：按类型调用各自的列表接口（或演示仓储），映射为统一结果条目。
 * 文章正文命中时用后端返回的命中窗口生成摘录；闪念与朋友圈直接从正文截取命中处，找不到时退回摘要或正文开头。
 * @author TixXin
 * @since 2026-11-03
 */
import { fetchPostPage } from '~/features/post/api'
import type { PostItem } from '~/features/post/types'
import { fetchFlashSearchPage } from './flash'
import { buildExcerpt } from './excerpt'
import type { SearchResultItem, SearchType } from './types'

export interface SearchSourceContext {
  apiBaseUrl: string
  /** 文章演示仓储开关（postUseMockRepo） */
  postMock: boolean
  /** 其余内容演示仓储开关（useMockRepo） */
  mock: boolean
  projects: ReturnType<typeof useProjectRepository>
  links: ReturnType<typeof useLinkRepository>
  gallery: ReturnType<typeof useGalleryRepository>
  moments: ReturnType<typeof useMomentRepository>
  flashes: ReturnType<typeof useFlashRepository>
}

export interface SearchSourceRequest {
  source: SearchType
  keyword: string
  page: number
  pageSize: number
  signal: AbortSignal
}

export interface SearchSourcePage {
  total: number
  items: SearchResultItem[]
}

const text = (value: string) => value.replace(/\s+/g, ' ').trim()

function searchItem(
  value: Omit<SearchResultItem, 'id' | 'title' | 'description'> & {
    id: string | number
    title: string
    description: string
  },
): SearchResultItem {
  return {
    ...value,
    id: String(value.id),
    title: text(value.title).slice(0, 100),
    description: text(value.description).slice(0, 200),
  }
}

/** 文章描述：正文命中时显示命中摘录，否则显示摘要 */
export function postDescription(post: Pick<PostItem, 'summary' | 'contentMatch'>, keyword: string) {
  return (post.contentMatch && buildExcerpt(post.contentMatch, keyword)) || post.summary
}

/** 闪念与朋友圈描述：正文里命中处的摘录，命中在标签等其他字段时显示正文开头 */
export function noteDescription(content: string, keyword: string) {
  return buildExcerpt(content, keyword) ?? content
}

function postResult(post: PostItem, keyword: string) {
  return searchItem({
    type: 'post',
    id: post.id,
    title: post.title,
    description: postDescription(post, keyword),
    url: articlePath(post),
    icon: 'lucide:file-text',
  })
}

async function readPosts(context: SearchSourceContext, request: SearchSourceRequest): Promise<SearchSourcePage> {
  const { keyword, page, pageSize } = request
  if (context.postMock) {
    const [{ mockPosts }, { default: Fuse }] = await Promise.all([import('~/features/post/mock'), import('fuse.js')])
    const matches = new Fuse(mockPosts, { keys: ['title', 'summary'], threshold: 0.4 }).search(keyword)
    return {
      total: matches.length,
      items: matches.slice((page - 1) * pageSize, page * pageSize).map(({ item }) => postResult(item, keyword)),
    }
  }
  const value = await fetchPostPage(context.apiBaseUrl, { search: keyword, page, pageSize }, request.signal)
  return { total: value.total, items: value.items.map((post) => postResult(post, keyword)) }
}

async function readMockFlashes(context: SearchSourceContext, request: SearchSourceRequest): Promise<SearchSourcePage> {
  const { keyword, page, pageSize } = request
  const lower = keyword.toLocaleLowerCase()
  const notes = await (context.flashes.listPublic?.() ?? context.flashes.list('tixxin'))
  const matches = notes
    .filter(
      (note) =>
        !note.isDraft &&
        !note.isArchived &&
        (note.content.toLocaleLowerCase().includes(lower) ||
          note.tags.some((tag) => tag.toLocaleLowerCase().includes(lower))),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  return {
    total: matches.length,
    items: matches.slice((page - 1) * pageSize, page * pageSize).map((note) => flashResult(note, keyword)),
  }
}

function flashResult(note: { id: string; content: string }, keyword: string) {
  return searchItem({
    type: 'flash',
    id: note.id,
    title: note.content,
    description: noteDescription(note.content, keyword),
    url: '/flash/' + encodeURIComponent(note.id),
    icon: 'lucide:lightbulb',
  })
}

async function readFlashes(context: SearchSourceContext, request: SearchSourceRequest): Promise<SearchSourcePage> {
  if (context.mock) return readMockFlashes(context, request)
  const { keyword, page, pageSize, signal } = request
  const value = await fetchFlashSearchPage(context.apiBaseUrl, keyword, page, pageSize, signal)
  return { total: value.total, items: value.items.map((note) => flashResult(note, keyword)) }
}

async function readCollections(context: SearchSourceContext, request: SearchSourceRequest): Promise<SearchSourcePage> {
  const { source, keyword, page, pageSize, signal } = request
  const paging = { q: keyword, page, pageSize }
  if (source === 'project') {
    const value = await context.projects.list(paging, signal)
    return {
      total: value.total,
      items: value.items.map((project) =>
        searchItem({
          type: source,
          id: project.id,
          title: project.title,
          description: project.description,
          url: '/projects?project=' + project.id,
          icon: 'lucide:layers',
        }),
      ),
    }
  }
  if (source === 'link') {
    const value = await context.links.list(paging, signal)
    return {
      total: value.total,
      items: value.items.map((link) =>
        searchItem({
          type: source,
          id: link.id,
          title: link.name,
          description: link.description,
          url: link.url,
          icon: 'lucide:link',
        }),
      ),
    }
  }
  const value = await context.gallery.list(paging, signal)
  return {
    total: value.total,
    items: value.items.map((photo) =>
      searchItem({
        type: 'gallery',
        id: photo.id,
        title: photo.title,
        description: photo.description || photo.category,
        url: '/gallery?photo=' + photo.id,
        icon: 'lucide:images',
      }),
    ),
  }
}

async function readMoments(context: SearchSourceContext, request: SearchSourceRequest): Promise<SearchSourcePage> {
  const { keyword, page, pageSize, signal } = request
  const value = await context.moments.list({ q: keyword, page, pageSize }, signal)
  return {
    total: value.total,
    items: value.items.map((moment) =>
      searchItem({
        type: 'moment',
        id: moment.id,
        title: moment.content,
        description: noteDescription(moment.content, keyword),
        url: '/moments/' + encodeURIComponent(moment.id),
        icon: 'lucide:messages-square',
      }),
    ),
  }
}

/** 读取单个来源的一页结果 */
export function readSearchSource(
  context: SearchSourceContext,
  request: SearchSourceRequest,
): Promise<SearchSourcePage> {
  if (request.source === 'post') return readPosts(context, request)
  if (request.source === 'flash') return readFlashes(context, request)
  if (request.source === 'moment') return readMoments(context, request)
  return readCollections(context, request)
}
