/**
 * @file types.ts
 * @description 媒体资源与引用查询的前后端契约。
 */
export interface MediaAsset {
  id: string
  name: string
  url: string
  alt: string
  width: number
  height: number
  byteSize: number
  mimeType: string
  createdAt: string
  deleted: boolean
}
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
    title: string
    url: string
    revision?: number
  }[]
}
