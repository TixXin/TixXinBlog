/**
 * @file useMomentPagination.ts
 * @description 朋友圈无限滚动分页逻辑，含话题筛选与 IntersectionObserver
 * @author TixXin
 * @since 2026-04-10
 */

import type { MomentItem } from '~/features/moment/types'

const PAGE_SIZE = 5
const SPINNER_DELAY = 250

interface MomentPaginationOptions {
  allMoments: Ref<MomentItem[]>
  selectedTopic: Ref<string | null>
  pageSize?: number
}

export function useMomentPagination(options: MomentPaginationOptions) {
  const { allMoments, selectedTopic, pageSize = PAGE_SIZE } = options

  // 根据话题筛选
  const filteredMoments = computed(() => {
    if (!selectedTopic.value) return allMoments.value
    return allMoments.value.filter((m) => m.topics?.includes(selectedTopic.value!))
  })

  const displayCount = ref(pageSize)
  const loading = ref(false)
  const showSpinner = ref(false)
  const sentinelRef = ref<HTMLElement | null>(null)
  let spinnerTimer: ReturnType<typeof setTimeout> | null = null

  const displayedMoments = computed(() => filteredMoments.value.slice(0, displayCount.value))

  const hasMore = computed(() => displayCount.value < filteredMoments.value.length)

  // 话题切换时重置
  watch(selectedTopic, () => {
    displayCount.value = pageSize
  })

  function clearSpinnerTimer() {
    if (spinnerTimer) {
      clearTimeout(spinnerTimer)
      spinnerTimer = null
    }
  }

  function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true

    clearSpinnerTimer()
    spinnerTimer = setTimeout(() => {
      if (loading.value) showSpinner.value = true
    }, SPINNER_DELAY)

    requestAnimationFrame(() => {
      displayCount.value = Math.min(displayCount.value + pageSize, filteredMoments.value.length)
      loading.value = false
      showSpinner.value = false
      clearSpinnerTimer()
    })
  }

  // IntersectionObserver
  let observer: IntersectionObserver | null = null

  function setupObserver() {
    observer?.disconnect()

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '0px 0px 400px 0px' },
    )

    if (sentinelRef.value) {
      observer.observe(sentinelRef.value)
    }
  }

  watch(sentinelRef, (el) => {
    if (el && observer) {
      observer.observe(el)
    }
  })

  onMounted(() => {
    nextTick(() => setupObserver())
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
    clearSpinnerTimer()
  })

  return {
    filteredMoments,
    displayedMoments,
    hasMore,
    showSpinner,
    sentinelRef,
  }
}
