/**
 * @file useArticleDetail.ts
 * @description 文章详情数据源：postUseMockRepo 开关在 mock 与后端 API 之间切换
 * @author TixXin
 * @since 2026-04-03
 *
 * HTTP 模式解析数字或自定义地址，评论和相关推荐使用解析后的真实文章 ID。
 */

import { mockArticleDetail, mockTocItems, mockPosts } from '~/features/post/mock'
import { fetchArticleDetail, fetchPostNavigation, fetchRelatedPosts } from '~/features/post/api'
import type { ArticleDetail, RelatedPost, TocItem } from '~/features/post/types'

interface LoadedArticleSnapshot {
  requestId: string
  base: string
  article: ArticleDetail
  relatedPosts: RelatedPost[]
  navigation: { prev: RelatedPost | null; next: RelatedPost | null }
  discoveryError: boolean
  tocItems: TocItem[]
  excerpt: string
}
// 每个Nuxt应用只保留当前文章；不跨SSR请求共享，也不写入持久化存储。
const loadedArticles = new WeakMap<object, LoadedArticleSnapshot>()

export async function useArticleDetail(id: string, options: { reuseLoaded?: boolean } = {}) {
  const requestScope = usePageRequestScope()
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  const useMock = config.public.postUseMockRepo !== false
  const cached = loadedArticles.get(nuxtApp)
  if (!useMock && options.reuseLoaded && cached?.requestId === id && cached.base === config.public.apiBaseUrl) {
    return {
      article: computed(() => cached.article),
      relatedPosts: computed(() => cached.relatedPosts),
      navigation: computed(() => cached.navigation),
      discoveryError: ref(cached.discoveryError),
      tocItems: computed(() => cached.tocItems),
      articleExcerpt: computed(() => cached.excerpt),
    }
  }

  let article: ComputedRef<ArticleDetail>
  let tocItems: Ref<TocItem[]>
  let relatedFromApi: Ref<RelatedPost[] | undefined> = ref()
  let navigation: Ref<{ prev: RelatedPost | null; next: RelatedPost | null }> = ref({ prev: null, next: null })
  const discoveryError = ref(false)

  if (useMock) {
    if (!mockPosts.some((post) => String(post.id) === id))
      throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { title: '文章不存在' }, fatal: true })
    article = computed<ArticleDetail>(() => {
      const post = mockPosts.find((p) => p.id.toString() === id)
      if (post) {
        return {
          ...mockArticleDetail,
          id: post.id.toString(),
          title: post.title,
          cover: post.cover || '',
          date: post.date,
          // 文章卡片与详情头需保持中文展示，folder 字段是中文分类
          category: post.folder,
        }
      }
      return mockArticleDetail
    })
    tocItems = ref<TocItem[]>(mockTocItems)
    const sorted = [...mockPosts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    const position = sorted.findIndex((post) => String(post.id) === id)
    const map = (post: (typeof mockPosts)[number] | undefined): RelatedPost | null =>
      post ? { id: String(post.id), title: post.title, date: post.date, category: post.folder } : null
    navigation.value = { prev: map(sorted[position - 1]), next: map(sorted[position + 1]) }
  } else {
    const base = config.public.apiBaseUrl
    // 单个作用域内完成详情和补充读取，避免await之后再创建脱离页面的AsyncData订阅。
    const detailResult = await useAsyncData(`article-snapshot-${id}`, async (_app, { signal }) => {
      const requestSignal = AbortSignal.any([signal, requestScope.signal])
      const detail = await fetchArticleDetail(base, id, requestSignal)
      const [related, adjacent] = await Promise.allSettled([
        fetchRelatedPosts(base, detail.id, requestSignal),
        fetchPostNavigation(base, detail.id, requestSignal),
      ])
      return {
        detail,
        related: related.status === 'fulfilled' ? related.value : [],
        navigation: adjacent.status === 'fulfilled' ? adjacent.value : { prev: null, next: null },
        discoveryError: related.status === 'rejected' || adjacent.status === 'rejected',
      }
    })
    requestScope.assertActive()
    // 显式失败而非静默回退 mock，避免联调时"看似成功实际未连上"的假象
    if (detailResult.error.value || !detailResult.data.value) {
      const status = (detailResult.error.value as { statusCode?: number } | null)?.statusCode === 404 ? 404 : 503
      throw createError({
        statusCode: status,
        statusMessage: status === 404 ? '文章不存在' : '文章加载失败，请稍后重试',
        fatal: true,
      })
    }
    const data = detailResult.data
    relatedFromApi = computed(() => data.value?.related ?? [])
    navigation = computed(() => data.value?.navigation ?? { prev: null, next: null })
    discoveryError.value = data.value!.discoveryError
    article = computed<ArticleDetail>(() => data.value!.detail)
    tocItems = computed<TocItem[]>(() => data.value?.detail.toc ?? [])
  }

  const relatedPosts = computed<RelatedPost[]>(() => {
    if (!useMock) return relatedFromApi.value ?? []
    const current = article.value
    const currentTags = new Set(mockPosts.find((p) => p.id.toString() === id)?.tags.map((t) => t.label) ?? [])

    return mockPosts
      .filter((p) => p.id.toString() !== id)
      .map((p) => ({
        post: p,
        score: (p.category === current.category ? 2 : 0) + p.tags.filter((t) => currentTags.has(t.label)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((r) => ({
        id: r.post.id.toString(),
        title: r.post.title,
        date: r.post.date,
        category: r.post.category,
      }))
  })

  const articleExcerpt = computed(() => {
    if (article.value.summary) return article.value.summary
    const firstParagraph = article.value.content?.find((s: { type: string }) => s.type === 'paragraph')
    return firstParagraph?.text?.slice(0, 160) ?? '阅读 TixXin Blog 上的文章'
  })

  if (!useMock)
    loadedArticles.set(nuxtApp, {
      requestId: id,
      base: config.public.apiBaseUrl,
      article: article.value,
      relatedPosts: relatedPosts.value,
      navigation: navigation.value,
      discoveryError: discoveryError.value,
      tocItems: tocItems.value,
      excerpt: articleExcerpt.value,
    })

  return {
    article,
    relatedPosts,
    navigation,
    discoveryError,
    tocItems,
    articleExcerpt,
  }
}
