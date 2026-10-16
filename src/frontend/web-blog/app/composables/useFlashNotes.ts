/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、增删改、首次 seed、tag 聚合
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 所有数据操作都委托给 FlashNoteRepository，本文件不直接读写 localStorage
 * - 跨页面通过 useState 共享实体列表，公开回访按 30 秒新鲜期重新验证
 * - 未登录时回退展示博主（owner）的闪念列表（只读）；登录后切换到当前用户自己的列表
 * - 写操作仅对登录用户开放，未登录触发 useLoginDrawer.open()
 */

import type { FlashComment, FlashNote, FlashNoteDraft } from '~/features/flash/types'
import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from '~/features/flash/mock'
import { mockOwnerUser } from '~/features/auth/mock'
import { FLASH_PUBLIC_FRESH_MS, FLASH_PUBLIC_STALE_MS, invalidateFlashNotes } from '~/features/flash/state'

/**
 * 增量补种：seed 版本升级时，把当前 list 里没有的 seed id 补进 storage。
 * 已存在的 id 跳过（保留用户对该条目的修改/删除/归档），归档项也算"已存在"。
 * 一次性，写入版本号后下次 load 直接跳过。
 */
async function ensureSeedsUpToDate(repo: ReturnType<typeof useFlashRepository>, userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const versionKey = `flash:seeds:version:${userId}`
  const localVersion = Number(window.localStorage.getItem(versionKey) ?? '0')
  if (localVersion >= FLASH_SEEDS_VERSION) return

  const [active, archived] = await Promise.all([repo.list(userId), repo.listArchived(userId)])
  const existingIds = new Set([...active, ...archived].map((n) => n.id))
  for (const draft of defaultFlashNoteSeeds) {
    if (draft.id && !existingIds.has(draft.id)) {
      await repo.create(userId, draft)
    }
  }
  window.localStorage.setItem(versionKey, String(FLASH_SEEDS_VERSION))
}

export function useFlashNotes() {
  const app = useNuxtApp()
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  // 本地演示数据归属站点所有者；真实管理员 UUID 不应创建第二份重复的站点数据。
  const contentOwnerId = computed(() =>
    currentUser.value?.role === 'owner' ? mockOwnerUser.id : (currentUser.value?.id ?? mockOwnerUser.id),
  )
  const { open: openLoginDrawer } = useLoginDrawer()
  // HTTP 模式下种子由后端 DevSeeder 负责,前端不再补种(create 是管理员能力)
  const shouldSeedLocally = useRuntimeConfig().public.useMockRepo !== false

  const notes = useState<FlashNote[]>('flash-notes', () => [])
  const loaded = useState<boolean>('flash-notes-loaded', () => false)
  const loading = useState<boolean>('flash-notes-loading', () => false)
  const error = useState<string | null>('flash-notes-error', () => null)
  const loadedAt = useState('flash-notes-loaded-at', () => 0)
  const invalidated = useState('flash-notes-invalidated', () => false)
  const loadedOwner = useState('flash-notes-owner', () => '')
  const contentContext = useState<string>('page-content-context', () => '')
  /** 当前展示的所有者：owner（未登录回退）或 self（登录后看自己的） */
  const viewingScope = useState<'self' | 'owner'>('flash-notes-scope', () => 'owner')
  const ownerKey = computed(() =>
    JSON.stringify([
      currentUser.value?.id ?? null,
      isLoggedIn.value ? 'self' : 'owner',
      contentOwnerId.value,
      contentContext.value,
    ]),
  )
  function synchronizeOwner() {
    if (loadedOwner.value === ownerKey.value) return
    invalidateFlashNotes(app, { clear: true })
    loadedOwner.value = ownerKey.value
    viewingScope.value = isLoggedIn.value ? 'self' : 'owner'
  }
  // 重新挂载时在首次渲染前清理旧身份；活动页面的身份变化也不能等待异步请求再隐藏草稿。
  synchronizeOwner()
  watch(ownerKey, synchronizeOwner, { flush: 'sync' })

  /** 是否处于只读模式：未登录时只能浏览博主的闪念 */
  const isReadOnly = computed(() => !isLoggedIn.value)

  /**
   * 加载笔记列表。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的闪念列表，同样支持 seed
   */
  const loadVersion = useState('flash-load-version', () => 0)
  async function load(force = false) {
    synchronizeOwner()
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const nextScope: 'self' | 'owner' = isLoggedIn.value ? 'self' : 'owner'
    const age = Date.now() - loadedAt.value
    const timedPublicRead = nextScope === 'owner' && !shouldSeedLocally
    const fresh = !invalidated.value && (shouldSeedLocally || (age >= 0 && age < FLASH_PUBLIC_FRESH_MS))
    if (loaded.value && !force && fresh) return

    const version = ++loadVersion.value
    const ownsLoad = () => version === loadVersion.value && owner === ownerKey.value
    // 私有实体仍由原仓储接纳写入；公开数据超过 5 分钟或已撤销时不再展示旧结果。
    if (timedPublicRead && (invalidated.value || age < 0 || age > FLASH_PUBLIC_STALE_MS)) {
      notes.value = []
      loaded.value = false
    }
    loading.value = true
    error.value = null
    try {
      let list = await repo.list(targetUserId)
      if (!ownsLoad()) return
      if (shouldSeedLocally) {
        if (list.length === 0) {
          // 全新用户：全量 seed
          for (const draft of defaultFlashNoteSeeds) {
            await repo.create(targetUserId, draft)
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`flash:seeds:version:${targetUserId}`, String(FLASH_SEEDS_VERSION))
          }
          list = await repo.list(targetUserId)
        } else {
          // 老用户：按版本增量补种新增的 seed id（不动用户已修改/删除/归档的）
          await ensureSeedsUpToDate(repo, targetUserId)
          list = await repo.list(targetUserId)
        }
      }
      if (!ownsLoad()) return
      notes.value = nextScope === 'owner' ? list.filter((note) => !note.isDraft && !note.isArchived) : list
      viewingScope.value = nextScope
      loaded.value = true
      loadedAt.value = Date.now()
      invalidated.value = false
    } catch (e) {
      if (ownsLoad()) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (ownsLoad()) loading.value = false
    }
  }

  function assertOwner(owner: string) {
    if (owner !== ownerKey.value) throw new Error('闪念所属身份或内容库已变化，请重新核对后操作')
  }
  function acceptWrite(owner: string, apply: (current: FlashNote[]) => FlashNote[]) {
    assertOwner(owner)
    invalidateFlashNotes(app)
    notes.value = apply(notes.value)
    // 写入先完成而首次列表仍在途中时，撤销旧响应后重新取得完整集合。
    if (!loaded.value) void load(true)
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
    return list.filter((note) => !note.isDraft && !note.isArchived)
  }

  /**
   * 切换点赞 —— 游客也可操作，设备级每日去重由 UI 层（flash.vue）管理。
   * composable 层不再检查登录态，只负责数据读写。
   */
  async function toggleLike(id: string): Promise<boolean> {
    const owner = ownerKey.value
    const updated = await repo.toggleLike(id)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
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

    const owner = ownerKey.value
    const created = await repo.addComment(noteId, {
      authorId,
      authorName,
      authorAvatar,
      content,
    })
    acceptWrite(owner, (current) =>
      current.map((n) => (n.id === noteId ? { ...n, comments: [...n.comments, created] } : n)),
    )
    return created
  }

  /**
   * 删除评论 —— 不再强制登录，游客也能删除自己发的评论。
   * 权限校验在 UI 层通过 canDeleteComment 完成（匹配 currentUserId 或 guestId）。
   */
  async function removeComment(noteId: string, commentId: string): Promise<boolean> {
    const owner = ownerKey.value
    await repo.removeComment(noteId, commentId)
    acceptWrite(owner, (current) =>
      current.map((n) => (n.id === noteId ? { ...n, comments: n.comments.filter((c) => c.id !== commentId) } : n)),
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
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
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
    ownerKey,
    isReadOnly,
    tagCloud,
    monthlyCount,
    load,
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
