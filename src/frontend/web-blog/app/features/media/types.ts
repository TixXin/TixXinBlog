/**
 * @file types.ts
 * @description 媒体资源与引用查询的前后端契约。
 */
export interface MediaAsset {
  id: string
  name: string
  url: string
  alt: string
  description: string
  width: number
  height: number
  byteSize: number
  mimeType: string
  createdAt: string
  deleted: boolean
}
export type MediaOrientation = '' | 'landscape' | 'portrait' | 'square'
export type MediaUsage = '' | 'used' | 'unused'
export interface MediaReferences {
  total: number
  page: number
  pageSize: number
  items: {
    kind:
      | 'post'
      | 'revision'
      | 'flash'
      | 'site'
      | 'site-revision'
      | 'comment'
      | 'flash-comment'
      | 'moment'
      | 'moment-comment'
      | 'guestbook'
      | 'gallery'
      | 'project'
      | 'subscription'
      | 'link'
      | 'image-prompt'
    title: string
    url: string
    /** 历史版本引用的版本号；当前内容引用为 null */
    revision?: number | null
  }[]
}
export interface MediaRemovalResult {
  id: string
  name: string
  status: 'removed' | 'referenced' | 'failed'
  message: string
  references?: MediaReferences
}
