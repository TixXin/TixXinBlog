/**
 * @file useSearch.ts
 * @description 客户端模糊搜索 composable，基于 Fuse.js
 * @author TixXin
 * @since 2026-04-06
 */

import type Fuse from 'fuse.js'
import { fetchPostPage } from '~/features/post/api'
import { mockPosts } from '~/features/post/mock'
import { mockLinks } from '~/features/link/mock'
import type { PostItem } from '~/features/post/types'
import type { ProjectItem } from '~/features/project/types'
import type { LinkItem } from '~/features/link/types'

export interface SearchResultItem {
  type: 'post' | 'project' | 'link'
  id: string
  title: string
  description: string
  url: string
  icon: string
}

let fuseInstance: Fuse<SearchResultItem> | null = null
let fuseItems: SearchResultItem[] = []

async function getFuse(items: SearchResultItem[]) {
  if (fuseInstance && fuseItems === items) return fuseInstance
  const { default: FuseClass } = await import('fuse.js')
  fuseItems = items
  fuseInstance = new FuseClass(items, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'description', weight: 0.3 },
      { name: 'type', weight: 0.2 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
  })
  return fuseInstance
}

export function useSearch() {
  const config = useRuntimeConfig()
  const projects = useProjectRepository()
  const error = ref('')
  let version = 0
  let controller: AbortController | undefined
  let alive = true
  const query = ref('')
  const results = ref<SearchResultItem[]>([])
  const isSearching = ref(false)

  function buildSearchItems(posts: PostItem[], projects: ProjectItem[], links: LinkItem[]): SearchResultItem[] {
    const items: SearchResultItem[] = []

    for (const post of posts) {
      items.push({
        type: 'post',
        id: post.id.toString(),
        title: post.title,
        description: post.summary,
        url: articlePath(post),
        icon: 'lucide:file-text',
      })
    }

    for (const project of projects) {
      items.push({
        type: 'project',
        id: String(project.id),
        title: project.title,
        description: project.description,
        url: `/projects?q=${encodeURIComponent(project.title)}`,
        icon: 'lucide:layers',
      })
    }

    for (const link of links) {
      items.push({
        type: 'link',
        id: link.name,
        title: link.name,
        description: link.description,
        url: link.url,
        icon: 'lucide:link',
      })
    }

    return items
  }

  async function search(q: string) {
    const requestVersion = ++version
    controller?.abort()
    query.value = q
    error.value = ''
    if (!q.trim()) {
      results.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    controller = new AbortController()
    try {
      const useMock = config.public.postUseMockRepo !== false
      const keyword = q.trim().slice(0, 200),
        signal = controller.signal
      const [postRead, projectRead, localRead] = await Promise.allSettled([
        useMock
          ? Promise.resolve([] as PostItem[])
          : fetchPostPage(config.public.apiBaseUrl, { search: keyword, pageSize: 10 }, signal).then(
              (page) => page.items,
            ),
        projects.list({ q: keyword, page: 1, pageSize: 10 }, signal),
        getFuse(buildSearchItems(useMock ? mockPosts : [], [], mockLinks)).then((fuse) =>
          fuse.search(keyword, { limit: 10 }).map((match) => match.item),
        ),
      ])
      if (alive && requestVersion === version && query.value === q) {
        const projectItems = projectRead.status === 'fulfilled' ? projectRead.value.items : []
        const postItems = postRead.status === 'fulfilled' ? postRead.value : []
        const local = localRead.status === 'fulfilled' ? localRead.value : []
        results.value = [
          ...buildSearchItems([], projectItems, []),
          ...buildSearchItems(postItems, [], []),
          ...local,
        ].slice(0, 10)
        const unavailable = [
          projectRead.status === 'rejected' ? '项目' : '',
          postRead.status === 'rejected' ? '文章' : '',
          localRead.status === 'rejected' ? '本地资料' : '',
        ].filter(Boolean)
        error.value = unavailable.length
          ? `${unavailable.join('、')}搜索暂时不可用，请重试。${results.value.length ? '以下保留其他来源的可用结果。' : ''}`
          : ''
      }
    } catch {
      if (alive && requestVersion === version && query.value === q) {
        error.value = '搜索暂时不可用，请稍后重试'
        results.value = []
      }
    } finally {
      if (alive && requestVersion === version && query.value === q) isSearching.value = false
    }
  }
  onScopeDispose(() => {
    alive = false
    version++
    controller?.abort()
  })

  return {
    query,
    results,
    isSearching,
    error,
    search,
  }
}
