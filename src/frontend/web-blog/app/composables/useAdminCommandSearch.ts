/**
 * @file useAdminCommandSearch.ts
 * @description 命令面板的结果：静态命令（新建、页面）即时匹配，文章按标题经接口搜索（250ms 防抖、只取最新一次、最多 5 篇）；
 *              文章搜索失败不影响其他结果
 * @author TixXin
 * @since 2026-11-06
 */
import type { AdminCommand } from '~/features/admin/commands'
import { adminStaticCommands, matchCommands } from '~/features/admin/commands'
import type { AdminPostListRow } from '~/features/post/types'

export function useAdminCommandSearch(query: Ref<string>, open: Ref<boolean>) {
  const { t } = useI18n()
  const api = useAdminApi()
  const posts = ref<AdminCommand[]>([])
  const postsPending = ref(false)
  const postsError = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let version = 0

  const staticResults = computed(() => matchCommands(adminStaticCommands(t), query.value))
  const results = computed(() => [...staticResults.value, ...posts.value])

  async function searchPosts(text: string, current: number) {
    try {
      const data = await api<{ items: AdminPostListRow[] }>('/admin/posts', {
        query: { search: text, page: 1, pageSize: 5 },
      })
      if (current !== version) return
      posts.value = data.items.map((post) => ({
        id: `post:${post.id}`,
        group: 'posts',
        label: post.title,
        icon: 'lucide:file-text',
        to: `/admin/posts/${post.id}`,
      }))
    } catch {
      if (current === version) postsError.value = true
    } finally {
      if (current === version) postsPending.value = false
    }
  }

  watch([query, open], ([value, isOpen]) => {
    clearTimeout(timer)
    const current = ++version
    const text = value.trim()
    posts.value = []
    postsError.value = false
    postsPending.value = !!text && isOpen
    if (postsPending.value) timer = setTimeout(() => void searchPosts(text, current), 250)
  })
  onScopeDispose(() => clearTimeout(timer))

  return { results, postsPending, postsError }
}
