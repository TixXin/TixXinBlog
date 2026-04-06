/**
 * @file useReadingHistory.ts
 * @description 阅读历史记录 composable，使用 localStorage 持久化
 * @author TixXin
 * @since 2026-04-06
 */

export interface HistoryItem {
  id: string
  title: string
  cover?: string
  date: string
  visitedAt: string
}

const HISTORY_KEY = 'tixxin-blog-reading-history'
const MAX_ITEMS = 50

function loadHistory(): HistoryItem[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

export function useReadingHistory() {
  const history = useState<HistoryItem[]>('reading-history', () => [])

  onMounted(() => {
    history.value = loadHistory()
  })

  function addToHistory(item: Omit<HistoryItem, 'visitedAt'>) {
    const items = history.value.filter((h) => h.id !== item.id)
    items.unshift({
      ...item,
      visitedAt: new Date().toISOString(),
    })
    history.value = items.slice(0, MAX_ITEMS)
    saveHistory(history.value)
  }

  function clearHistory() {
    history.value = []
    localStorage.removeItem(HISTORY_KEY)
  }

  return {
    history,
    addToHistory,
    clearHistory,
  }
}
