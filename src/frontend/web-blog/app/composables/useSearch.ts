/**
 * @file useSearch.ts
 * @description 客户端模糊搜索 composable，基于 Fuse.js
 * @author TixXin
 * @since 2026-04-06
 */

import type Fuse from 'fuse.js'
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
        url: `/articles/${post.id}`,
        icon: 'lucide:file-text',
      })
    }

    for (const project of projects) {
      items.push({
        type: 'project',
        id: project.title,
        title: project.title,
        description: project.description,
        url: '/projects',
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

  async function search(q: string, posts: PostItem[], projects: ProjectItem[], links: LinkItem[]) {
    query.value = q
    if (!q.trim()) {
      results.value = []
      return
    }

    isSearching.value = true
    try {
      const items = buildSearchItems(posts, projects, links)
      const fuse = await getFuse(items)
      results.value = fuse!.search(q, { limit: 10 }).map((r) => r.item)
    } finally {
      isSearching.value = false
    }
  }

  return {
    query,
    results,
    isSearching,
    search,
  }
}
