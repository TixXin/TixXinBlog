/**
 * @file bookmarkSession.ts
 * @description 标签页书签的共享状态：分类与书签列表、加载与错误、当前分类与浏览范围，内容归属与登录校验
 * @author TixXin
 * @since 2026-10-27
 */
import type { Bookmark, BookmarkCategory } from './types'
import { mockOwnerUser } from '~/features/auth/mock'

export type TabBookmarkSession = ReturnType<typeof createTabBookmarkSession>

export function createTabBookmarkSession() {
  const repo = useTabRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  // 本地演示数据归属站点所有者；真实管理员 UUID 不应创建第二份重复的站点数据。
  const contentOwnerId = computed(() =>
    currentUser.value?.role === 'owner' ? mockOwnerUser.id : (currentUser.value?.id ?? mockOwnerUser.id),
  )
  const { open: openLoginDrawer } = useLoginDrawer()
  // 用全局 i18n 实例而非 useI18n：本 composable 也会在插件或测试中脱离组件 setup 调用
  const { t } = useNuxtApp().$i18n

  const categories = useState<BookmarkCategory[]>('tab-categories', () => [])
  const bookmarks = useState<Bookmark[]>('tab-bookmarks', () => [])
  const loaded = useState<boolean>('tab-loaded', () => false)
  const loading = useState<boolean>('tab-loading', () => false)
  const error = useState<string | null>('tab-error', () => null)
  const activeCategoryId = useState<string | null>('tab-active-category', () => null)
  /** 当前展示的所有者：owner（未登录回退）或 self（登录后看自己的） */
  const viewingScope = useState<'self' | 'owner'>('tab-viewing-scope', () => 'owner')

  /** 是否处于只读模式：未登录时只能浏览博主的标签页 */
  const isReadOnly = computed(() => !isLoggedIn.value)
  /** 已建立完整登录身份才允许写入 */
  const canWrite = () => isLoggedIn.value && !!currentUser.value
  /** 写操作的登录校验：未登录时打开登录抽屉并拒绝 */
  function requireLogin() {
    if (canWrite()) return true
    openLoginDrawer('login')
    return false
  }

  return {
    ...{ repo, currentUser, isLoggedIn, contentOwnerId, t, categories, bookmarks, loaded, loading, error },
    ...{ activeCategoryId, viewingScope, isReadOnly, canWrite, requireLogin },
  }
}
