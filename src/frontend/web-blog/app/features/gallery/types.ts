/**
 * @file types.ts
 * @description 画廊模块类型定义
 * @author TixXin
 * @since 2025-03-17
 */

export interface PhotoItem {
  id: number
  title: string
  description: string
  src: string
  srcLarge: string
  width?: number
  height?: number
  category: string
  date: string
  location: string
  device?: string
  format?: string
  publishedAt?: string | null
}

export interface GalleryCategory {
  label: string
  value: string
  count?: number
}

export interface GalleryStat {
  label: string
  value: string
}

export interface GearItem {
  icon: string
  name: string
  description: string
}

export type GalleryStatus = 'draft' | 'published' | 'withdrawn'
export interface GalleryEditable {
  mediaId: string
  title: string
  description: string
  category: string
  takenOn: string | null
  location: string
  device: string
  status: GalleryStatus
  sortOrder: number
}
export interface ManagedPhoto extends Omit<PhotoItem, 'device'>, GalleryEditable {
  revision: number
  createdAt: string
  updatedAt: string
}
export interface GalleryQuery {
  q?: string
  category?: string
  page: number
  pageSize: number
}
export interface GalleryPage<T = PhotoItem> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface GalleryMetadata {
  categories: GalleryCategory[]
  stats: { photos: number; locations: number; categories: number }
  gear: GearItem[]
}
export interface GallerySettings {
  gear: GearItem[]
  revision: number
  updatedAt: string
}
export interface GalleryNavigation {
  matched: boolean
  page: number | null
  previousId: number | null
  nextId: number | null
  previousPage: number | null
  nextPage: number | null
}
