/**
 * @file useArticleDetail.ts
 * @description 文章详情数据获取 composable，当前使用 mock 数据，后续替换为 useAsyncData
 * @author TixXin
 * @since 2026-04-03
 */

import {
  mockArticleDetail,
  mockComments,
  mockRelatedPosts,
  mockTocItems,
} from '~/features/post/mock'
import type {
  ArticleDetail,
  CommentItem,
  RelatedPost,
  TocItem,
} from '~/features/post/types'

export function useArticleDetail(_id: string) {
  // TODO: 后续替换为 useAsyncData(`article-${id}`, () => $fetch(`/api/articles/${id}`))
  const article = computed<ArticleDetail>(() => mockArticleDetail)
  const comments = ref<CommentItem[]>(mockComments)
  const relatedPosts = ref<RelatedPost[]>(mockRelatedPosts)
  const tocItems = ref<TocItem[]>(mockTocItems)

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
