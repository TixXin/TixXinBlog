/**
 * @file useLikes.ts
 * @description 文章点赞与收藏 composable，使用 localStorage 持久化
 * @author TixXin
 * @since 2026-04-06
 */

const LIKES_KEY = 'tixxin-blog-likes'
const FAVORITES_KEY = 'tixxin-blog-favorites'

function loadSet(key: string): Set<string> {
  if (import.meta.server) return new Set()
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

export function useLikes() {
  const { error: showError } = useToast()
  const likedIds = useState<Set<string>>('liked-ids', () => new Set())
  const favoritedIds = useState<Set<string>>('favorited-ids', () => new Set())

  onMounted(() => {
    likedIds.value = loadSet(LIKES_KEY)
    favoritedIds.value = loadSet(FAVORITES_KEY)
  })

  function isLiked(id: string) {
    return likedIds.value.has(id)
  }

  function toggleLike(id: string) {
    const set = new Set(likedIds.value)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    try {
      saveSet(LIKES_KEY, set)
      likedIds.value = set
      return true
    } catch {
      showError('点赞未保存：浏览器存储不可用或空间不足，请重试')
      return false
    }
  }

  function isFavorited(id: string) {
    return favoritedIds.value.has(id)
  }

  function toggleFavorite(id: string) {
    const set = new Set(favoritedIds.value)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    try {
      saveSet(FAVORITES_KEY, set)
      favoritedIds.value = set
      return true
    } catch {
      showError('收藏未保存：浏览器存储不可用或空间不足，请重试')
      return false
    }
  }

  return {
    likedIds,
    favoritedIds,
    isLiked,
    toggleLike,
    isFavorited,
    toggleFavorite,
  }
}
