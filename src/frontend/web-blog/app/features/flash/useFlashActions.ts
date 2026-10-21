/**
 * @file useFlashActions.ts
 * @description 闪念写入与互动编排：增删改查、点赞、置顶、归档及评论提交与写后失效
 * @author TixXin
 * @since 2026-10-21
 */

import type { ComputedRef, Ref } from 'vue'
import type { NuxtApp } from '#app'
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import type { CurrentUser } from '~/features/auth/types'
import type { FlashComment, FlashNote, FlashNoteDraft, FlashOverview } from '~/features/flash/types'
import { appendComment, withoutComment } from '~/features/flash/comments'
import { flashMomentMessage } from '~/features/flash/messages'
import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from '~/features/flash/mock'
import { mockOwnerUser } from '~/features/auth/mock'
import { invalidateFlashNotes } from '~/features/flash/state'
import { ensureSeedsUpToDate } from '~/features/flash/seed'
import { isPublicNote } from '~/features/flash/publicFilter'

export interface FlashActionsContext {
  app: NuxtApp
  repo: ReturnType<typeof useFlashRepository>
  currentUser: Ref<CurrentUser | null>
  isLoggedIn: Ref<boolean>
  contentOwnerId: ComputedRef<string>
  ownerKey: ComputedRef<string>
  notes: Ref<FlashNote[]>
  loaded: Ref<boolean>
  overview: Ref<FlashOverview | null>
  pagedPublic: ComputedRef<boolean>
  overviewLoaded: Ref<boolean>
  shouldSeedLocally: boolean
  load: (force?: boolean) => Promise<void>
  loadOverview: (force?: boolean) => Promise<void>
}

export function useFlashActions(ctx: FlashActionsContext) {
  const {
    app,
    repo,
    currentUser,
    isLoggedIn,
    contentOwnerId,
    ownerKey,
    notes,
    loaded,
    overview,
    pagedPublic,
    overviewLoaded,
    shouldSeedLocally,
    load,
    loadOverview,
  } = ctx
  const { open: openLoginDrawer } = useLoginDrawer()

  function assertOwner(owner: string) {
    if (owner !== ownerKey.value) throw new Error(flashMomentMessage('flash-moment.request.ownerChanged'))
  }

  function acceptWrite(owner: string, apply: (current: FlashNote[]) => FlashNote[]) {
    assertOwner(owner)
    invalidateFlashNotes(app)
    notes.value = apply(notes.value)
    // 写入先完成而首次列表仍在途中时，撤销旧响应后重新取得完整集合。
    if (!loaded.value) void load(true)
    // 在途概览随写入作废；尚未取得概览时重新读取，侧栏不停在空白
    if (pagedPublic.value && !overviewLoaded.value) void loadOverview(true)
  }

  /** 创建一条新闪念。未登录则打开登录弹窗。 */
  async function add(draft: FlashNoteDraft): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const created = await repo.create(contentOwnerId.value, draft)
    acceptWrite(owner, (current) => [created, ...current.filter((note) => note.id !== created.id)])
    return created
  }

  /** 更新指定闪念 */
  async function update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.update(id, patch)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    return updated
  }

  /** 删除指定闪念 */
  async function remove(id: string): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    const owner = ownerKey.value
    await repo.remove(id)
    acceptWrite(owner, (current) => current.filter((n) => n.id !== id))
    return true
  }

  /** 关键词搜索（基于当前展示的列表所属用户） */
  async function search(query: string): Promise<FlashNote[]> {
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const result = await repo.search(targetUserId, query)
    assertOwner(owner)
    return result
  }

  /**
   * 单独拉取博主（owner）的公开闪念列表，不影响主 notes 状态。
   * 详情页用：任何访客都能看到博主笔记，不受登录态影响。
   */
  async function fetchOwnerNotes(): Promise<FlashNote[]> {
    if (repo.listPublic) return repo.listPublic()
    let list = await repo.list(mockOwnerUser.id)
    if (shouldSeedLocally) {
      if (list.length === 0) {
        for (const draft of defaultFlashNoteSeeds) {
          await repo.create(mockOwnerUser.id, draft)
        }
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`flash:seeds:version:${mockOwnerUser.id}`, String(FLASH_SEEDS_VERSION))
        }
        list = await repo.list(mockOwnerUser.id)
      } else {
        await ensureSeedsUpToDate(repo, mockOwnerUser.id)
        list = await repo.list(mockOwnerUser.id)
      }
    }
    return list.filter((note) => isPublicNote(note))
  }

  /**
   * 切换点赞 —— 游客也可操作，设备级每日去重由 UI 层管理。
   * composable 层不再检查登录态，只负责数据读写。
   */
  async function toggleLike(id: string): Promise<boolean> {
    const owner = ownerKey.value
    const updated = await repo.toggleLike(id)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    // 概览中的已赞编号同步本次结果，翻到下一页或回访时不回退
    const current = overview.value
    if (pagedPublic.value && current) {
      const others = current.likedIds.filter((likedId) => likedId !== id)
      overview.value = { ...current, likedIds: updated.liked ? [...others, id] : others }
    }
    return true
  }

  /** 设置置顶态（仅登录者） */
  async function setPinned(id: string, pinned: boolean): Promise<FlashNote | null> {
    if (!isLoggedIn.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.setPinned(id, pinned)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    return updated
  }

  /**
   * 归档指定闪念（仅登录者）。归档后 list() 不再返回，归档箱视图单独拉取。
   * unarchive（恢复）走 setArchived(false)。
   */
  async function setArchived(id: string, archived: boolean): Promise<FlashNote | null> {
    if (!isLoggedIn.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.setArchived(id, archived)
    acceptWrite(owner, (current) => {
      const remaining = current.filter((n) => n.id !== id)
      return archived ? remaining : [updated, ...remaining]
    })
    return updated
  }

  /** 加载归档箱列表，返回给 UI 单独展示，不污染主 notes 状态 */
  async function loadArchived(): Promise<FlashNote[]> {
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const result = await repo.listArchived(targetUserId)
    assertOwner(owner)
    return result
  }

  /**
   * 添加评论 —— 支持登录用户和游客两种身份来源。
   */
  async function addComment(
    noteId: string,
    content: string,
    guestAuthor?: { id: string; name: string; avatar: string },
    fields: VisitorSubmissionFields = {},
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
      return null
    }

    const owner = ownerKey.value
    const created = await repo.addComment(noteId, {
      ...fields,
      authorId,
      authorName,
      authorAvatar,
      content,
    })
    acceptWrite(owner, (current) => current.map((n) => (n.id === noteId ? appendComment(n, created) : n)))
    return created
  }

  /**
   * 删除评论
   */
  async function removeComment(noteId: string, commentId: string): Promise<boolean> {
    const owner = ownerKey.value
    await repo.removeComment(noteId, commentId)
    acceptWrite(owner, (current) => current.map((n) => (n.id === noteId ? withoutComment(n, commentId) : n)))
    return true
  }

  return {
    add,
    update,
    remove,
    search,
    fetchOwnerNotes,
    toggleLike,
    setPinned,
    setArchived,
    loadArchived,
    addComment,
    removeComment,
  }
}
