/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、分页追加、所有权同步与公开/私有状态编排；按会话、读取、分页、概览与操作组装
 * @author TixXin
 * @since 2026-04-11
 */

import type { FlashPublicFilter } from '~/features/flash/publicFilter'
import { useFlashOverviewState } from '~/features/flash/useFlashOverviewState'
import { useFlashActions } from '~/features/flash/useFlashActions'
import { createFlashNotesSession, type FlashNotesSession } from '~/features/flash/notesSession'
import { createFlashNotesLoader } from '~/features/flash/notesLoad'
import { createFlashPublicPaging } from '~/features/flash/notesPaging'

export type { FlashPublicFilter }

export function useFlashNotes() {
  const s = createFlashNotesSession()
  const { app, repo, notes, loaded, pagedPublic, ownerKey } = s

  // SSR 写入的读取时刻来自服务器时钟；水合时按本机时钟重新起算，避免时钟偏差把首屏判成过期并清空。
  if (import.meta.client && app.isHydrating && s.serverRendered.value) {
    s.loadedAt.value = Date.now()
    s.serverRendered.value = false
  }

  const overviewState = useFlashOverviewState({
    repo,
    pagedPublic,
    ownerKey,
    notes,
    loaded,
    publicTotal: s.publicTotal,
  })
  const { loadVersion, load } = createFlashNotesLoader(s)
  const { setPublicFilter, loadMore } = createFlashPublicPaging(s, loadVersion, load)

  const actions = useNotesActions(s, overviewState, load)

  return {
    notes,
    loaded,
    loading: s.loading,
    error: s.error,
    viewingScope: s.viewingScope,
    ownerKey,
    isReadOnly: s.isReadOnly,
    pagedPublic,
    total: s.total,
    hasMore: s.hasMore,
    moreLoading: s.moreLoading,
    moreError: s.moreError,
    overview: overviewState.overviewData,
    overviewLoaded: overviewState.overviewLoaded,
    overviewLoading: overviewState.overviewLoading,
    overviewError: overviewState.overviewError,
    overviewRetrying: overviewState.overviewRetrying,
    aggregatesReady: overviewState.aggregatesReady,
    totalCount: overviewState.totalCount,
    tagCloud: overviewState.tagCloud,
    monthlyCount: overviewState.monthlyCount,
    load,
    loadMore,
    loadOverview: overviewState.loadOverview,
    retryOverview: overviewState.retryOverview,
    setPublicFilter,
    ...actions,
  }
}

/** 写入与互动操作共享列表、概览与读取入口 */
function useNotesActions(
  s: FlashNotesSession,
  overviewState: ReturnType<typeof useFlashOverviewState>,
  load: (force?: boolean) => Promise<void>,
) {
  return useFlashActions({
    app: s.app,
    repo: s.repo,
    currentUser: s.currentUser,
    isLoggedIn: s.isLoggedIn,
    contentOwnerId: s.contentOwnerId,
    ownerKey: s.ownerKey,
    notes: s.notes,
    loaded: s.loaded,
    overview: overviewState.overview,
    pagedPublic: s.pagedPublic,
    overviewLoaded: overviewState.overviewLoaded,
    shouldSeedLocally: s.shouldSeedLocally,
    load,
    loadOverview: overviewState.loadOverview,
  })
}
