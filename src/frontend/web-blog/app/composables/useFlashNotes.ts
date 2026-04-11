/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、增删改、首次 seed、tag 聚合
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 所有数据操作都委托给 FlashNoteRepository，本文件不直接读写 localStorage
 * - 跨页面通过 useState 共享响应式 notes 列表，切换路由不重新拉取
 * - 未登录时所有写操作触发 useLoginDrawer.open()，引导登录后再继续
 */

import type { FlashNote, FlashNoteDraft } from '~/features/flash/types'
import { defaultFlashNoteSeeds } from '~/features/flash/mock'

export function useFlashNotes() {
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  const { open: openLoginDrawer } = useLoginDrawer()

  const notes = useState<FlashNote[]>('flash-notes', () => [])
  const loaded = useState<boolean>('flash-notes-loaded', () => false)
  const loading = useState<boolean>('flash-notes-loading', () => false)
  const error = useState<string | null>('flash-notes-error', () => null)

  /**
   * 加载当前用户的笔记列表。首次加载（用户列表为空）时自动注入 seed 示例。
   * SSR 安全：方法在 onMounted 后调用，typeof window 必然存在。
   */
  async function load(force = false) {
    if (!isLoggedIn.value || !currentUser.value) {
      notes.value = []
      loaded.value = true
      return
    }
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      const userId = currentUser.value.id
      let list = await repo.list(userId)
      if (list.length === 0) {
        // 首次进入：注入 seed 示例笔记，按顺序写入以保留时间倒序合理性
        for (const draft of defaultFlashNoteSeeds) {
          await repo.create(userId, draft)
        }
        list = await repo.list(userId)
      }
      notes.value = list
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

  /** 关键词搜索（不修改主列表，仅返回匹配项） */
  async function search(query: string): Promise<FlashNote[]> {
    if (!isLoggedIn.value || !currentUser.value) return []
    return repo.search(currentUser.value.id, query)
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
    tagCloud,
    monthlyCount,
    load,
    add,
    update,
    remove,
    search,
  }
}
