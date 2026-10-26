/** @file useMediaLoader.ts @description 媒体列表读取与地址同步：分页读取、越界回退、筛选提交、翻页和地址变化后重读 */
import type { ComputedRef } from 'vue'
import type { MediaAsset } from './types'
import type { MediaFilters } from './library'
import {
  mediaAddressQuery,
  mediaLastPage,
  mediaListQuery,
  readMediaOrientation,
  readMediaPage,
  readMediaUsage,
} from './library'
import type { MediaWorkspace } from './useMediaWorkspace'

const MEDIA_PATH = '/admin/media'

function currentFilters(ctx: MediaWorkspace): MediaFilters {
  return {
    search: ctx.search.value,
    deleted: ctx.deleted.value,
    orientation: ctx.orientation.value,
    usage: ctx.usage.value,
    page: ctx.page.value,
  }
}

export interface MediaLoaderDeps {
  clearSelection: () => void
  syncDrafts: (assets: MediaAsset[]) => void
}

export function createMediaLoader(ctx: MediaWorkspace, deps: MediaLoaderDeps) {
  const { guard, items, total, page, pending, ready, error } = ctx
  async function load() {
    if (guard.disposed) return
    deps.clearSelection()
    if (!ctx.claimWorkspace()) return
    const version = ++guard.requestVersion
    const operation = guard.ownershipVersion
    pending.value = true
    error.value = ''
    try {
      const result = await ctx.api<{ items: MediaAsset[]; total: number }>(MEDIA_PATH, {
        query: mediaListQuery(currentFilters(ctx)),
      })
      if (version !== guard.requestVersion || !ctx.ownsOperation(operation)) return
      items.value = result.items
      ready.value = true
      error.value = ''
      total.value = result.total
      deps.syncDrafts(result.items)
      const last = mediaLastPage(total.value)
      if (page.value > last) {
        page.value = last
        await load()
      }
    } catch {
      if (version === guard.requestVersion) error.value = ctx.t('admin-media.mediaMessages.loadFailed')
    } finally {
      if (version === guard.requestVersion) pending.value = false
    }
  }
  return { load }
}

/** 筛选提交与翻页：先同步地址，地址未变时直接重读；地址变化由路由监听重读 */
export function createMediaNavigation(
  ctx: MediaWorkspace,
  hasDirtyMetadata: ComputedRef<boolean>,
  load: () => Promise<void>,
) {
  const route = useRoute()
  const router = useRouter()
  const { working, uploading, pending, page } = ctx
  async function syncAddress() {
    if (ctx.selectable) return false
    const query = mediaAddressQuery(currentFilters(ctx))
    if (router.resolve({ path: MEDIA_PATH, query }).fullPath === route.fullPath) return false
    await router.replace({ path: MEDIA_PATH, query })
    return true
  }
  async function goTo(value: number) {
    if (working.value || uploading.value || pending.value || !ctx.allowAction()) return
    if (hasDirtyMetadata.value) {
      ctx.error.value = ctx.t('admin-media.mediaMessages.saveDraftsFirst')
      return
    }
    page.value = value
    if (!(await syncAddress())) await load()
  }
  watch(
    () => route.query,
    () => {
      if (ctx.selectable || route.path !== MEDIA_PATH) return
      ctx.search.value = typeof route.query.search === 'string' ? route.query.search : ''
      ctx.deleted.value = route.query.deleted === 'true' ? 'true' : 'false'
      ctx.orientation.value = readMediaOrientation(route.query.orientation)
      ctx.usage.value = readMediaUsage(route.query.usage)
      page.value = readMediaPage(route.query.page)
      if (ctx.ready.value) void load()
    },
  )
  return { searchMedia: () => goTo(1), changePage: goTo }
}
