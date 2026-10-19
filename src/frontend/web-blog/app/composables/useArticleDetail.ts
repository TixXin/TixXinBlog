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
import type { ArticleDetail, PostNavigation, RelatedPost, TocItem } from '~/features/post/types'
import { articleTocItems } from '~/utils/articleMarkdown'

interface LoadedArticleSnapshot {
  requestId: string
  base: string
  article: ArticleDetail
  relatedPosts: RelatedPost[]
  navigation: PostNavigation
  navigationFolder: string | null
  discoveryError: boolean
  tocItems: TocItem[]
  excerpt: string
}
// 每个Nuxt应用只保留当前文章；不跨SSR请求共享，也不写入持久化存储。
const loadedArticles = new WeakMap<object, LoadedArticleSnapshot>()

/** 纯数字地址就是文章 ID，补充读取无需等待详情解析 */
export function isNumericArticleId(id: string) {
  return /^\d+$/.test(id)
}

export async function useArticleDetail(id: string, options: { reuseLoaded?: boolean } = {}) {
  const requestScope = usePageRequestScope()
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  // 用全局 i18n 实例而非 useI18n：本 composable 也会在插件或测试中脱离组件 setup 调用
  const { t } = useNuxtApp().$i18n
  const base = config.public.apiBaseUrl
  const useMock = config.public.postUseMockRepo !== false
  const cached = loadedArticles.get(nuxtApp)
  let article: ComputedRef<ArticleDetail>
  let tocItems: Ref<TocItem[]>
  // 推荐与相邻文章用可写 ref：首读、主题复用和单独重试都写回同一份状态。
  const relatedFromApi = ref<RelatedPost[]>([])
  const navigation = ref<PostNavigation>({ prev: null, next: null })
  const navigationFolder = ref<string | null>(null)
  const discoveryError = ref(false)
  const discoveryPending = ref(false)

  if (!useMock && options.reuseLoaded && cached?.requestId === id && cached.base === base) {
    // 主题切换复用已加载文章，不重新读取；补充读取失败时仍可通过 retryDiscovery 重试。
    article = computed(() => cached.article)
    relatedFromApi.value = cached.relatedPosts
    navigation.value = cached.navigation
    navigationFolder.value = cached.navigationFolder
    discoveryError.value = cached.discoveryError
    tocItems = ref(cached.tocItems)
  } else if (useMock) {
    if (!mockPosts.some((post) => String(post.id) === id))
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        data: { title: t('article.detail.notFound') },
        fatal: true,
      })
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
    const folder = article.value.category
    const sameFolder = folder.trim() ? sorted.filter((post) => post.folder === folder) : []
    const candidates = sameFolder.length > 1 ? sameFolder : sorted
    navigationFolder.value = sameFolder.length > 1 ? folder : null
    const position = candidates.findIndex((post) => String(post.id) === id)
    const map = (post: (typeof mockPosts)[number] | undefined): RelatedPost | null =>
      post ? { id: String(post.id), slug: post.slug, title: post.title, date: post.date, category: post.folder } : null
    navigation.value = { prev: map(candidates[position - 1]), next: map(candidates[position + 1]) }
  } else {
    // 接口地址也是数据身份的一部分，避免同一文章沿用其他接口的结果或请求闭包。
    const snapshotKey = `article-snapshot-${JSON.stringify([base, id])}`
    // 单个作用域内完成详情和补充读取，避免await之后再创建脱离页面的AsyncData订阅。
    const detailResult = await useAsyncData(snapshotKey, async (_app, { signal }) => {
      const discoveryAbort = new AbortController()
      const requestSignal = AbortSignal.any([signal, requestScope.signal])
      const discoverySignal = AbortSignal.any([requestSignal, discoveryAbort.signal])
      // 数字地址的推荐和上下篇都与详情并行；自定义地址等详情解析出数字 ID 后再读取。
      // 上下篇用 auto 范围：服务端按文章专栏查找，专栏两侧为空时在同一请求内回退全站并标明。
      // 详情失败时中止并丢弃已发起的补充读取，错误仍由详情决定。
      const detailRead = fetchArticleDetail(base, id, requestSignal).catch((error: unknown) => {
        discoveryAbort.abort()
        throw error
      })
      const numeric = isNumericArticleId(id)
      const relatedRead = numeric
        ? fetchRelatedPosts(base, id, discoverySignal)
        : detailRead.then((detail) => fetchRelatedPosts(base, detail.id, discoverySignal))
      const navigationRead = numeric
        ? fetchPostNavigation(base, id, discoverySignal, 'auto')
        : detailRead.then((detail) => fetchPostNavigation(base, detail.id, discoverySignal, 'auto'))
      const discovery = Promise.allSettled([relatedRead, navigationRead])
      const detail = await detailRead
      const [related, adjacent] = await discovery
      // 专栏标签取自详情；回退全站的结果不标注专栏。
      const folder = detail.category.trim() ? detail.category : null
      return {
        detail,
        related: related.status === 'fulfilled' ? related.value : [],
        navigation:
          adjacent.status === 'fulfilled'
            ? { prev: adjacent.value.prev, next: adjacent.value.next }
            : { prev: null, next: null },
        navigationFolder: adjacent.status === 'fulfilled' && !adjacent.value.fallback ? folder : null,
        discoveryError: related.status === 'rejected' || adjacent.status === 'rejected',
      }
    })
    requestScope.assertActive()
    // 显式失败而非静默回退 mock，避免联调时"看似成功实际未连上"的假象
    if (detailResult.error.value || !detailResult.data.value) {
      const status = (detailResult.error.value as { statusCode?: number } | null)?.statusCode === 404 ? 404 : 503
      throw createError({
        statusCode: status,
        statusMessage: status === 404 ? t('article.detail.notFound') : t('article.detail.loadFailed'),
        fatal: true,
      })
    }
    const data = detailResult.data
    relatedFromApi.value = data.value!.related
    navigation.value = data.value!.navigation
    navigationFolder.value = data.value!.navigationFolder
    discoveryError.value = data.value!.discoveryError
    article = computed<ArticleDetail>(() => data.value!.detail)
    tocItems = computed<TocItem[]>(() => articleTocItems(data.value?.detail.toc ?? [], data.value?.detail.title ?? ''))
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

  // 摘要优先；缺摘要时用后端首段摘录，旧结构化正文与演示数据仍可从段落兜底。
  const articleExcerpt = computed(() => {
    if (article.value.summary) return article.value.summary
    if (article.value.excerpt) return article.value.excerpt
    const firstParagraph = article.value.content?.find((s: { type: string }) => s.type === 'paragraph')
    return firstParagraph?.text?.slice(0, 160) ?? t('article.detail.defaultExcerpt')
  })

  if (!useMock)
    loadedArticles.set(nuxtApp, {
      requestId: id,
      base,
      article: article.value,
      relatedPosts: relatedPosts.value,
      navigation: navigation.value,
      navigationFolder: navigationFolder.value,
      discoveryError: discoveryError.value,
      tocItems: tocItems.value,
      excerpt: articleExcerpt.value,
    })

  async function retryDiscovery() {
    if (useMock || discoveryPending.value || requestScope.signal.aborted) return
    discoveryPending.value = true
    try {
      const [related, adjacent] = await Promise.allSettled([
        fetchRelatedPosts(base, article.value.id, requestScope.signal),
        fetchPostNavigation(base, article.value.id, requestScope.signal, 'auto'),
      ])
      // 页面已卸载时丢弃迟到结果；某一路失败时保留另一路已读到的内容。
      if (requestScope.signal.aborted) return
      if (related.status === 'fulfilled') relatedFromApi.value = related.value
      if (adjacent.status === 'fulfilled') {
        // 与首读一致：同专栏结果标注专栏名，回退全站时不标注。
        const folder = article.value.category.trim() ? article.value.category : null
        navigation.value = { prev: adjacent.value.prev, next: adjacent.value.next }
        navigationFolder.value = adjacent.value.fallback ? null : folder
      }
      discoveryError.value = related.status === 'rejected' || adjacent.status === 'rejected'
      const snapshot = loadedArticles.get(nuxtApp)
      if (snapshot?.requestId === id && snapshot.base === base) {
        snapshot.relatedPosts = relatedPosts.value
        snapshot.navigation = navigation.value
        snapshot.navigationFolder = navigationFolder.value
        snapshot.discoveryError = discoveryError.value
      }
    } finally {
      discoveryPending.value = false
    }
  }

  return {
    article,
    relatedPosts,
    navigation,
    navigationFolder,
    discoveryError,
    discoveryPending,
    retryDiscovery,
    tocItems,
    articleExcerpt,
  }
}
