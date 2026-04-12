/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、增删改、首次 seed、tag 聚合
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 所有数据操作都委托给 FlashNoteRepository，本文件不直接读写 localStorage
 * - 跨页面通过 useState 共享响应式 notes 列表，切换路由不重新拉取
 * - 未登录时回退展示博主（owner）的闪念列表（只读）；登录后切换到当前用户自己的列表
 * - 写操作仅对登录用户开放，未登录触发 useLoginDrawer.open()
 */

import type { FlashComment, FlashNote, FlashNoteDraft } from '~/features/flash/types'
import { defaultFlashNoteSeeds } from '~/features/flash/mock'
import { mockOwnerUser } from '~/features/auth/mock'

export function useFlashNotes() {
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  const { open: openLoginDrawer } = useLoginDrawer()

  const notes = useState<FlashNote[]>('flash-notes', () => [])
  const loaded = useState<boolean>('flash-notes-loaded', () => false)
  const loading = useState<boolean>('flash-notes-loading', () => false)
  const error = useState<string | null>('flash-notes-error', () => null)
  /** 当前展示的所有者：owner（未登录回退）或 self（登录后看自己的） */
  const viewingScope = useState<'self' | 'owner'>('flash-notes-scope', () => 'owner')

  /** 是否处于只读模式：未登录时只能浏览博主的闪念 */
  const isReadOnly = computed(() => !isLoggedIn.value)

  /**
   * 加载笔记列表。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的闪念列表，同样支持 seed
   */
  async function load(force = false) {
    const targetUserId = isLoggedIn.value && currentUser.value ? currentUser.value.id : mockOwnerUser.id
    const nextScope: 'self' | 'owner' = isLoggedIn.value ? 'self' : 'owner'

    // 切换到不同 scope 时强制重载，避免显示上一身份的笔记
    if (loaded.value && !force && viewingScope.value === nextScope) return

    loading.value = true
    error.value = null
    try {
      let list = await repo.list(targetUserId)
      if (list.length === 0) {
        for (const draft of defaultFlashNoteSeeds) {
          await repo.create(targetUserId, draft)
        }
        list = await repo.list(targetUserId)
      }
      notes.value = list
      viewingScope.value = nextScope
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 创建一条新闪念。未登录则打开登录弹窗。 */
  async function add(draft: FlashNoteDraft): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const created = await repo.create(currentUser.value.id, draft)
    notes.value = [created, ...notes.value]
    return created
  }

  /** 更新指定闪念 */
  async function update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const updated = await repo.update(id, patch)
    notes.value = notes.value.map((n) => (n.id === id ? updated : n))
    return updated
  }

  /** 删除指定闪念 */
  async function remove(id: string): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    await repo.remove(id)
    notes.value = notes.value.filter((n) => n.id !== id)
    return true
  }

  /** 关键词搜索（基于当前展示的列表所属用户） */
  async function search(query: string): Promise<FlashNote[]> {
    const targetUserId = isLoggedIn.value && currentUser.value ? currentUser.value.id : mockOwnerUser.id
    return repo.search(targetUserId, query)
  }

  /**
   * 切换点赞 —— 游客也可操作，设备级每日去重由 UI 层（flash.vue）管理。
   * composable 层不再检查登录态，只负责数据读写。
   */
  async function toggleLike(id: string): Promise<boolean> {
    const updated = await repo.toggleLike(id)
    notes.value = notes.value.map((n) => (n.id === id ? updated : n))
    return true
  }

  /**
   * 添加评论 —— 支持登录用户和游客两种身份来源。
   * 登录用户自动取 currentUser 信息；游客由调用方传入 guestAuthor。
   * 若两者都没有则返回 null，由 UI 层决定是否弹出身份录入面板。
   */
  async function addComment(
    noteId: string,
    content: string,
    guestAuthor?: { id: string; name: string; avatar: string },
  ): Promise<FlashComment | null> {
    let authorId: string
    let authorName: string
    let authorAvatar: string

    if (isLoggedIn.value && currentUser.value) {
      authorId = currentUser.value.id
      authorName = currentUser.value.nickname
      authorAvatar = currentUser.value.avatar
    } else if (guestAuthor) {
      authorId = guestAuthor.id
      authorName = guestAuthor.name
      authorAvatar = guestAuthor.avatar
    } else {
      // 无身份 → UI 层弹出身份录入
      return null
    }

    const created = await repo.addComment(noteId, {
      authorId,
      authorName,
      authorAvatar,
      content,
    })
    notes.value = notes.value.map((n) =>
      n.id === noteId ? { ...n, comments: [...n.comments, created] } : n,
    )
    return created
  }

  /**
   * 删除评论 —— 不再强制登录，游客也能删除自己发的评论。
   * 权限校验在 UI 层通过 canDeleteComment 完成（匹配 currentUserId 或 guestId）。
   */
  async function removeComment(noteId: string, commentId: string): Promise<boolean> {
    await repo.removeComment(noteId, commentId)
    notes.value = notes.value.map((n) =>
      n.id === noteId ? { ...n, comments: n.comments.filter((c) => c.id !== commentId) } : n,
    )
    return true
  }

  /** 标签聚合：按出现次数倒序 */
  const tagCloud = computed<{ name: string; count: number }[]>(() => {
    const map = new Map<string, number>()
    notes.value.forEach((n) => {
      n.tags.forEach((t) => {
        map.set(t, (map.get(t) ?? 0) + 1)
      })
    })
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  })

  /** 本月新增数量 */
  const monthlyCount = computed(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return notes.value.filter((n) => n.createdAt.startsWith(ym)).length
  })

  return {
    notes,
    loaded,
    loading,
    error,
    viewingScope,
    isReadOnly,
    tagCloud,
    monthlyCount,
    load,
    add,
    update,
    remove,
    search,
    toggleLike,
    addComment,
    removeComment,
  }
}
