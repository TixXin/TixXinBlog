/**
 * @file useArticleDetail.ts
 * @description 文章详情数据获取 composable，当前使用 mock 数据，后续替换为 useAsyncData
 * @author TixXin
 * @since 2026-04-03
 */

import { mockArticleDetail, mockComments, mockTocItems, mockPosts } from '~/features/post/mock'
import type { ArticleDetail, CommentItem, RelatedPost, TocItem } from '~/features/post/types'

// 把 yyyy-mm-dd 字符串向后偏移 N 天，用来基于发布日生成评论时间，避免穿帮
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function useArticleDetail(id: string) {
  // TODO: 后续替换为 useAsyncData(`article-${id}`, () => $fetch(`/api/articles/${id}`))
  const article = computed<ArticleDetail>(() => {
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

  // 评论时间根据发布日动态偏移，确保每条评论都晚于发布日
  const baseDate = article.value.date
  const comments = ref<CommentItem[]>(
    mockComments.map((c, i) => ({
      ...c,
      time: shiftDate(baseDate, i + 1),
      replies: c.replies?.map((r, j) => ({
        ...r,
        time: shiftDate(baseDate, i + j + 2),
      })),
    })),
  )
  const tocItems = ref<TocItem[]>(mockTocItems)

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
