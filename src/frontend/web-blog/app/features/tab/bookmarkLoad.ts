/**
 * @file bookmarkLoad.ts
 * @description 标签页书签的加载：已登录读自己的列表，未登录回退博主列表；首次为空时注入种子，并保持或重选当前分类
 * @author TixXin
 * @since 2026-10-27
 */
import type { BookmarkCategory } from './types'
import { getSeedForUser } from './mock'
import type { TabBookmarkSession } from './bookmarkSession'

/** 首次进入：按用户 id 分发 seed（owner/visitor/空），种子书签按分类名关联；无种子时返回 null */
async function seedCategories(s: TabBookmarkSession, targetUserId: string) {
  const seed = getSeedForUser(targetUserId)
  if (seed.categories.length === 0) return null
  const created: BookmarkCategory[] = []
  for (const draft of seed.categories) {
    created.push(await s.repo.createCategory(targetUserId, draft))
  }
  const nameToId = new Map(created.map((c) => [c.name, c.id] as const))
  for (const bm of seed.bookmarks) {
    const categoryId = nameToId.get(bm.categoryName)
    if (!categoryId) continue
    await s.repo.createBookmark(targetUserId, {
      name: bm.name,
      url: bm.url,
      icon: bm.icon,
      color: bm.color,
      categoryId,
    })
  }
  return { cats: created, bms: await s.repo.listBookmarks(targetUserId) }
}

/** 默认选中第一个分类；scope 切换时上一身份的分类不在列表中，同样重选首个 */
function pickActiveCategory(s: TabBookmarkSession, cats: BookmarkCategory[]) {
  if (cats.length === 0) {
    s.activeCategoryId.value = null
    return
  }
  const stillExists = s.activeCategoryId.value && cats.some((c) => c.id === s.activeCategoryId.value)
  if (!stillExists) s.activeCategoryId.value = cats[0]!.id
}

/**
 * 加载分类与书签。
 * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
 * - 未登录：回退展示博主（mockOwnerUser）的列表，同样支持 seed
 */
export async function loadTabBookmarks(s: TabBookmarkSession, force = false) {
  const targetUserId = s.contentOwnerId.value
  const nextScope: 'self' | 'owner' = s.isLoggedIn.value ? 'self' : 'owner'

  // 切换到不同 scope 时强制重载，避免显示上一身份的数据
  if (s.loaded.value && !force && s.viewingScope.value === nextScope) return

  s.loading.value = true
  s.error.value = null
  try {
    let cats = await s.repo.listCategories(targetUserId)
    let bms = await s.repo.listBookmarks(targetUserId)
    if (cats.length === 0) {
      const seeded = await seedCategories(s, targetUserId)
      if (seeded) ({ cats, bms } = seeded)
    }
    s.categories.value = cats
    s.bookmarks.value = bms
    s.viewingScope.value = nextScope
    s.loaded.value = true
    pickActiveCategory(s, cats)
  } catch (e) {
    s.error.value = e instanceof Error ? e.message : String(e)
  } finally {
    s.loading.value = false
  }
}
