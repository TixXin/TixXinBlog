/**
 * @file useFlashArchiveState.ts
 * @description 闪念页面归档箱列表加载、展示切换与列表错误/加载中态聚合
 * @author TixXin
 * @since 2026-10-21
 */

import type { ComputedRef, Ref } from 'vue'
import type { FlashNote } from '~/features/flash/types'

export interface FlashArchiveStateOptions {
  isLoggedIn: Ref<boolean>
  storageError: Ref<string | null>
  loading: Ref<boolean>
  loaded: Ref<boolean>
  hasMore: ComputedRef<boolean>
  moreLoading: Ref<boolean>
  moreError: Ref<string | null>
  loadArchived: () => Promise<FlashNote[]>
  load: (force?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  loadOverview: () => Promise<void>
}

export function useFlashArchiveState(options: FlashArchiveStateOptions) {
  const {
    isLoggedIn,
    storageError,
    loading,
    loaded,
    hasMore,
    moreLoading,
    moreError,
    loadArchived,
    load,
    loadMore,
    loadOverview,
  } = options
  const { t } = useI18n()

  const showArchive = ref(false)
  const archivedNotes = ref<FlashNote[]>([])
  const archiveLoading = ref(false)
  const archiveLoaded = ref(false)
  const archiveError = ref<string | null>(null)
  let archiveVersion = 0

  const listError = computed(() => (showArchive.value ? archiveError.value : storageError.value))
  const listPending = computed(() => {
    if (showArchive.value) return archiveLoading.value || (!archiveLoaded.value && !archiveError.value)
    return loading.value || (!loaded.value && !storageError.value)
  })

  const listHasMore = computed(() => !showArchive.value && hasMore.value)
  const listMorePending = computed(() => moreLoading.value)
  const listMoreError = computed(() => moreError.value)
  function onMore() {
    void loadMore()
  }

  async function refreshArchived() {
    if (archiveLoading.value) return
    const version = ++archiveVersion
    archiveLoading.value = true
    archiveError.value = null
    try {
      const result = await loadArchived()
      if (version !== archiveVersion || !isLoggedIn.value) return
      archivedNotes.value = result
      archiveLoaded.value = true
    } catch (cause) {
      if (version === archiveVersion)
        archiveError.value = cause instanceof Error ? cause.message : t('flash-moment.flash.archiveLoadFailed')
    } finally {
      if (version === archiveVersion) archiveLoading.value = false
    }
  }

  async function retryList() {
    if (listPending.value) return
    if (showArchive.value) await refreshArchived()
    else {
      void loadOverview()
      await load(true)
    }
  }

  async function toggleArchiveView() {
    showArchive.value = !showArchive.value
    if (showArchive.value) await refreshArchived()
  }

  function resetArchive() {
    archiveVersion += 1
    showArchive.value = false
    archivedNotes.value = []
    archiveLoaded.value = false
    archiveLoading.value = false
    archiveError.value = null
  }

  onBeforeUnmount(() => {
    archiveVersion += 1
  })

  return {
    showArchive,
    archivedNotes,
    archiveLoading,
    archiveLoaded,
    archiveError,
    listError,
    listPending,
    listHasMore,
    listMorePending,
    listMoreError,
    onMore,
    refreshArchived,
    retryList,
    toggleArchiveView,
    resetArchive,
  }
}
