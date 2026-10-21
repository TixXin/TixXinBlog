/**
 * @file useFlashOverviewState.ts
 * @description 闪念公开概览与侧栏聚合状态：概览接口读取、点赞状态补齐、标签云与月度统计计算
 * @author TixXin
 * @since 2026-10-21
 */

import type { ComputedRef, Ref } from 'vue'
import type { FlashNote, FlashOverview } from '~/features/flash/types'
import { summarizeFlashNotes } from '~/features/flash/overview'
import { FLASH_PUBLIC_FRESH_MS } from '~/features/flash/state'

export interface FlashOverviewStateContext {
  repo: ReturnType<typeof useFlashRepository>
  pagedPublic: ComputedRef<boolean>
  ownerKey: ComputedRef<string>
  notes: Ref<FlashNote[]>
  loaded: Ref<boolean>
  publicTotal: Ref<number | null>
}

export function useFlashOverviewState(ctx: FlashOverviewStateContext) {
  const { repo, pagedPublic, ownerKey, notes, loaded, publicTotal } = ctx

  const overview = useState<FlashOverview | null>('flash-overview', () => null)
  const overviewLoaded = useState('flash-overview-loaded', () => false)
  const overviewLoading = useState('flash-overview-loading', () => false)
  const overviewError = useState<string | null>('flash-overview-error', () => null)
  const overviewLoadedAt = useState('flash-overview-loaded-at', () => 0)
  const overviewVersion = useState('flash-overview-version', () => 0)
  const overviewRetrying = ref(false)

  /** 按概览中的已赞编号补齐列表的个人点赞状态（SSR 首屏不带访客身份） */
  function applyLiked(likedIds: string[]) {
    const liked = new Set(likedIds)
    notes.value = notes.value.map((note) =>
      !!note.liked === liked.has(note.id) ? note : { ...note, liked: liked.has(note.id) },
    )
  }

  /**
   * 读取公开概览（一次聚合请求）：侧栏日历、统计、时间胶囊与标签云，以及首屏缺少的个人点赞状态。
   * 只在客户端挂载后调用，不阻塞首屏；30 秒内复用，写后失效或身份变化时作废在途结果。
   */
  async function loadOverview(force = false) {
    if (import.meta.server || !pagedPublic.value || !repo.overview) return
    const age = Date.now() - overviewLoadedAt.value
    if (overviewLoaded.value && !force && age >= 0 && age < FLASH_PUBLIC_FRESH_MS) return
    if (overviewLoading.value) return
    const version = ++overviewVersion.value
    const owner = ownerKey.value
    const owns = () => version === overviewVersion.value && owner === ownerKey.value
    overviewLoading.value = true
    overviewError.value = null
    try {
      const result = await repo.overview()
      if (!owns()) return
      overview.value = result
      overviewLoaded.value = true
      overviewLoadedAt.value = Date.now()
      applyLiked(result.likedIds)
    } catch (e) {
      if (owns()) overviewError.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (owns()) overviewLoading.value = false
    }
  }

  async function retryOverview() {
    if (overviewLoading.value) return
    overviewRetrying.value = true
    try {
      await loadOverview(true)
    } finally {
      overviewRetrying.value = false
    }
  }

  /** 侧栏聚合：公开分页视图用概览接口，私有视图与本地演示由已持有的完整集合计算 */
  const overviewData = computed<FlashOverview | null>(() => {
    if (pagedPublic.value) return overview.value
    return loaded.value ? summarizeFlashNotes(notes.value) : null
  })
  const aggregatesReady = computed(() => (pagedPublic.value ? overviewLoaded.value : loaded.value))
  /** 公开闪念总数：概览就绪前用首屏分页返回的总数 */
  const totalCount = computed<number | null>(() => {
    if (!pagedPublic.value) return loaded.value ? notes.value.length : null
    return overview.value?.total ?? publicTotal.value
  })

  /** 标签聚合：按出现次数倒序 */
  const tagCloud = computed<{ name: string; count: number }[]>(() => overviewData.value?.tags ?? [])

  /** 本月（UTC）新增数量 */
  const monthlyCount = computed(() => overviewData.value?.monthCount ?? 0)

  return {
    overview,
    overviewData,
    overviewLoaded,
    overviewLoading,
    overviewError,
    overviewRetrying,
    aggregatesReady,
    totalCount,
    tagCloud,
    monthlyCount,
    loadOverview,
    retryOverview,
  }
}
