/**
 * @file useFlashAISearch.ts
 * @description 闪念 AI 搜索的状态机：idle → loading → success/error
 * @author TixXin
 * @since 2026-04-11
 */

import type { FlashAISearchResult, FlashNote } from '~/features/flash/types'
import { mockFlashAISearch } from '~/features/flash/ai-search.mock'

type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

export function useFlashAISearch() {
  const status = ref<SearchStatus>('idle')
  const query = ref('')
  const result = ref<FlashAISearchResult | null>(null)
  const errorMsg = ref<string | null>(null)

  /** 触发一次 AI 搜索；调用方提供当前可见的笔记列表 */
  async function ask(text: string, notes: FlashNote[]) {
    const trimmed = text.trim()
    if (!trimmed) return
    query.value = trimmed
    status.value = 'loading'
    errorMsg.value = null
    result.value = null
    try {
      const res = await mockFlashAISearch(trimmed, notes)
      result.value = res
      status.value = 'success'
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  /** 清空状态，回到 idle */
  function reset() {
    status.value = 'idle'
    query.value = ''
    result.value = null
    errorMsg.value = null
  }

  return {
    status,
    query,
    result,
    errorMsg,
    ask,
    reset,
  }
}
