/** @file useMomentArticleSearch.ts @description 动态编辑器的引用文章搜索：防抖、取消旧请求、失败提示，并保留已引用的文章 */
import { fetchPostPage } from '~/features/post/api'
import type { ManagedMoment } from './types'

export interface MomentArticleSearchOptions {
  apiBase: string
  /** 编辑器仍在使用时为 true；卸载后丢弃迟到结果 */
  isAlive: () => boolean
  /** 当前引用的文章编号，搜索结果中没有它时仍保留在候选首位 */
  linkedArticleId: () => number | null
}

export function useMomentArticleSearch(options: MomentArticleSearchOptions) {
  const { t } = useI18n()
  const articleChoices = ref<{ id: number; title: string }[]>([]),
    articlesPending = ref(false),
    articlesError = ref('')
  let articleVersion = 0
  let articleTimer: ReturnType<typeof setTimeout> | undefined
  let articleController: AbortController | undefined
  function searchArticles(query: string) {
    const current = ++articleVersion
    if (articleTimer) clearTimeout(articleTimer)
    articleController?.abort()
    articlesPending.value = true
    articlesError.value = ''
    articleTimer = setTimeout(() => void fetchArticles(query, current), 250)
  }
  async function fetchArticles(query: string, current: number) {
    articleController = new AbortController()
    const isCurrent = () => options.isAlive() && current === articleVersion
    try {
      const result = await fetchPostPage(
        options.apiBase,
        { search: query.slice(0, 200), pageSize: 20 },
        articleController.signal,
      )
      if (!isCurrent()) return
      const retained = articleChoices.value.filter(
        (item) => item.id === options.linkedArticleId() && !result.items.some((post) => post.id === item.id),
      )
      articleChoices.value = [...retained, ...result.items.map((item) => ({ id: item.id, title: item.title }))]
    } catch {
      if (isCurrent()) articlesError.value = t('admin-content.momentEditor.articleSearchFailed')
    } finally {
      if (isCurrent()) articlesPending.value = false
    }
  }
  /** 读取或保存到动态后，以它引用的文章作为唯一候选 */
  function showLinkedArticle(note: ManagedMoment) {
    if (!note.linkedArticleId) return
    articleChoices.value = [
      { id: note.linkedArticleId, title: note.linkedArticle?.title ?? t('admin-content.momentEditor.hiddenArticle') },
    ]
  }
  function dispose() {
    articleVersion++
    if (articleTimer) clearTimeout(articleTimer)
    articleController?.abort()
  }
  return { articleChoices, articlesPending, articlesError, searchArticles, showLinkedArticle, dispose }
}
