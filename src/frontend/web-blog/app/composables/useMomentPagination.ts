/**
 * @file useMomentPagination.ts
 * @description 朋友圈无限滚动分页逻辑，含话题/日期筛选、fuse.js 全文搜索与 IntersectionObserver
 * @author TixXin
 * @since 2026-04-10
 */

import Fuse from 'fuse.js'
import type { MomentItem } from '~/features/moment/types'

const PAGE_SIZE = 5
const SPINNER_DELAY = 250

interface MomentPaginationOptions {
  allMoments: Ref<MomentItem[]>
  selectedTopic: Ref<string | null>
  selectedDate: Ref<string | null>
  /** 全文搜索关键词（可选） */
  keyword?: Ref<string>
  pageSize?: number
}

export function useMomentPagination(options: MomentPaginationOptions) {
  const { allMoments, selectedTopic, selectedDate, keyword, pageSize = PAGE_SIZE } = options

  // fuse.js 配置：keys 覆盖主要可搜字段，阈值偏宽松以支持中文近似匹配
  const fuseOptions: ConstructorParameters<typeof Fuse<MomentItem>>[1] = {
    keys: [
      { name: 'content', weight: 0.6 },
      { name: 'topics', weight: 0.2 },
      { name: 'location', weight: 0.1 },
      { name: 'linkedArticle.title', weight: 0.1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
  }

  // 筛选链：话题 → 日期 → 关键词（fuse）
  const filteredMoments = computed(() => {
    let result = allMoments.value
    if (selectedTopic.value) {
      result = result.filter((m) => m.topics?.includes(selectedTopic.value!))
    }
    if (selectedDate.value) {
      result = result.filter((m) => m.date.slice(0, 10) === selectedDate.value)
    }
    const kw = keyword?.value?.trim()
    if (kw) {
      // 小数据集（≤数百条）在筛选后的子集上现建 Fuse，性能可接受
      result = new Fuse(result, fuseOptions).search(kw).map((r) => r.item)
    }
    return result
  })

  const displayCount = ref(pageSize)
  const loading = ref(false)
  const showSpinner = ref(false)
  const sentinelRef = ref<HTMLElement | null>(null)
  let spinnerTimer: ReturnType<typeof setTimeout> | null = null

  const displayedMoments = computed(() => filteredMoments.value.slice(0, displayCount.value))

  const hasMore = computed(() => displayCount.value < filteredMoments.value.length)

  // 话题 / 日期 / 关键词切换时重置分页
  watch(
    () => [selectedTopic.value, selectedDate.value, keyword?.value ?? ''],
    () => {
      displayCount.value = pageSize
    },
  )

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
