/** @file useGalleryRepository.ts @description 图库真实 API 仓储，管理写入复用认证及内容上下文 */
import type {
  GalleryEditable,
  GalleryMetadata,
  GalleryNavigation,
  GalleryPage,
  GalleryQuery,
  GallerySettings,
  ManagedPhoto,
  PhotoItem,
} from '~/features/gallery/types'
import { galleryPayload } from '~/features/gallery/editor'
export function useGalleryRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, '')
  const admin = useAdminApi()
  // 在创建时取翻译函数：失败处理发生在 await 之后，已脱离 Nuxt 上下文
  const t = currentTranslate()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown } }
    const statusCode = cause?.statusCode ?? cause?.status
    const message =
      !statusCode || statusCode >= 500
        ? t('misc.gallery.repository.unavailable')
        : typeof cause.data?.message === 'string'
          ? cause.data.message
          : statusCode === 404
            ? t('misc.gallery.repository.notFound')
            : t('misc.shared.requestRejected')
    return Object.assign(new Error(message, { cause: value }), { statusCode })
  }
  async function read<T>(path: string, query?: GalleryQuery, signal?: AbortSignal): Promise<T> {
    try {
      const result = await $fetch<{ code: number; data: T }>(base + path, {
        query: query ? { ...query } : undefined,
        signal,
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error(t('misc.gallery.repository.incomplete'))
      return result.data
    } catch (cause) {
      throw failure(cause)
    }
  }
  async function manage<T>(path: string, options?: Parameters<typeof admin>[1]): Promise<T> {
    try {
      return await admin<T>(path, options)
    } catch (cause) {
      throw failure(cause)
    }
  }
  return {
    list: (query: GalleryQuery, signal?: AbortSignal) => read<GalleryPage>('/gallery', query, signal),
    detail: (id: number, signal?: AbortSignal) => read<PhotoItem>(`/gallery/${id}`, undefined, signal),
    navigation: (id: number, query: GalleryQuery, signal?: AbortSignal) =>
      read<GalleryNavigation>(`/gallery/${id}/navigation`, query, signal),
    metadata: (signal?: AbortSignal) => read<GalleryMetadata>('/gallery/metadata', undefined, signal),
    adminList: (query: GalleryQuery & { status?: string }) =>
      manage<GalleryPage<ManagedPhoto>>('/admin/gallery', { query: { ...query } }),
    adminDetail: (id: number) => manage<ManagedPhoto>(`/admin/gallery/${id}`),
    submission: (requestId: string) =>
      manage<{ state: 'saved'; item: ManagedPhoto } | { state: 'deleted'; id: number }>(
        `/admin/gallery/submissions/${requestId}`,
      ),
    save: (body: GalleryEditable, requestId: string, id?: number, revision?: number) =>
      id
        ? manage<ManagedPhoto>(`/admin/gallery/${id}`, { method: 'PATCH', body: { ...galleryPayload(body), revision } })
        : manage<ManagedPhoto>('/admin/gallery', { method: 'POST', body: { ...galleryPayload(body), requestId } }),
    update: (id: number, body: Partial<GalleryEditable>, revision: number) =>
      manage<ManagedPhoto>(`/admin/gallery/${id}`, { method: 'PATCH', body: { ...body, revision } }),
    remove: (id: number, revision: number) =>
      manage<{ ok: boolean }>(`/admin/gallery/${id}`, { method: 'DELETE', query: { revision } }),
    settings: () => manage<GallerySettings>('/admin/gallery/settings'),
    saveSettings: (body: Pick<GallerySettings, 'gear' | 'revision'>) =>
      manage<GallerySettings>('/admin/gallery/settings', { method: 'PATCH', body }),
  }
}
