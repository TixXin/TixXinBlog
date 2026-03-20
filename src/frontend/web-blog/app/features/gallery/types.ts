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
  category: string
  date: string
  location: string
}

export interface GalleryCategory {
  label: string
  value: string
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
