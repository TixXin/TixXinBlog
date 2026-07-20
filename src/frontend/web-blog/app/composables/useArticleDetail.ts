/**
 * @file useArticleDetail.ts
 * @description 文章详情数据源：useMockRepo 开关在 mock 与后端 API 之间切换
 * @author TixXin
 * @since 2026-04-03
 *
 * HTTP 模式下正文与 TOC 来自 GET /posts/:id；评论与相关推荐的后端接口尚未实现
 * （评论系统在 todo 中暂缓），暂沿用 mock 推导——种子数据与 mock 同源，id 一致。
 */

import { mockArticleDetail, mockComments, mockTocItems, mockPosts } from '~/features/post/mock'
import { fetchArticleDetail, fetchComments } from '~/features/post/api'
import type { ArticleDetail, CommentItem, RelatedPost, TocItem } from '~/features/post/types'

// 把 yyyy-mm-dd 字符串向后偏移 N 天，用来基于发布日生成评论时间，避免穿帮
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function useArticleDetail(id: string) {
  const config = useRuntimeConfig()
  const useMock = config.public.useMockRepo !== false

  let article: ComputedRef<ArticleDetail>
  let tocItems: Ref<TocItem[]>
  let comments: Ref<CommentItem[]>

  if (useMock) {
    article = computed<ArticleDetail>(() => {
      const post = mockPosts.find((p) => p.id.toString() === id)
      if (post) {
        return {
          ...mockArticleDetail,
          id: post.id.toString(),
          title: post.title,
          cover: post.cover || mockArticleDetail.cover,
          date: post.date,
          // 文章卡片与详情头需保持中文展示，folder 字段是中文分类
          category: post.folder,
        }
      }
      return mockArticleDetail
    })
    tocItems = ref<TocItem[]>(mockTocItems)

    // 评论时间根据发布日动态偏移，确保每条评论都晚于发布日
    const baseDate = article.value.date
    comments = ref<CommentItem[]>(
      mockComments.map((c, i) => ({
        ...c,
        time: shiftDate(baseDate, i + 1),
        replies: c.replies?.map((r, j) => ({
          ...r,
          time: shiftDate(baseDate, i + j + 2),
        })),
      })),
    )
  } else {
    const [detailResult, commentResult] = await Promise.all([
      useAsyncData(`article-${id}`, () => fetchArticleDetail(config.public.apiBaseUrl as string, id)),
      useAsyncData(`article-${id}-comments`, () => fetchComments(config.public.apiBaseUrl as string, id)),
    ])
    // 显式失败而非静默回退 mock，避免联调时"看似成功实际未连上"的假象
    if (detailResult.error.value || !detailResult.data.value) {
      throw createError({ statusCode: 404, statusMessage: '文章不存在或加载失败', fatal: true })
    }
    const data = detailResult.data
    article = computed<ArticleDetail>(() => data.value ?? mockArticleDetail)
    tocItems = computed<TocItem[]>(() => data.value?.toc ?? [])
    // 评论加载失败不阻塞正文,按空列表展示
    comments = computed<CommentItem[]>(() => commentResult.data.value ?? [])
  }

  const relatedPosts = computed<RelatedPost[]>(() => {
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
    const firstParagraph = article.value.content?.find((s: { type: string }) => s.type === 'paragraph')
    return firstParagraph?.text?.slice(0, 160) ?? '阅读 TixXin Blog 上的文章'
  })

  return {
    article,
    comments,
    relatedPosts,
    tocItems,
    articleExcerpt,
  }
}
