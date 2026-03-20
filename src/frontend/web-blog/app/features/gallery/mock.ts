/**
 * @file mock.ts
 * @description 画廊模块 mock 数据，包含照片、分类筛选、统计与器材信息
 * @author TixXin
 * @since 2026-03-20
 */

import type { GalleryCategory, GalleryStat, GearItem, PhotoItem } from './types'

const u = (id: string, w: 500 | 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

export const mockPhotos: PhotoItem[] = [
  {
    id: 1,
    title: '雪山日出',
    description: '清晨第一缕阳光照亮贡嘎主峰，云海与雪峰交织。',
    src: u('1506905925346-21bda4d32df4', 500),
    srcLarge: u('1506905925346-21bda4d32df4', 1200),
    category: 'landscape',
    date: '2024-01-15',
    location: '四川 · 贡嘎山',
  },
  {
    id: 2,
    title: '城市夜景',
    description: '陆家嘴灯火与黄浦江倒影，记录都市的脉搏。',
    src: u('1514565131-fce0801e5785', 500),
    srcLarge: u('1514565131-fce0801e5785', 1200),
    category: 'city',
    date: '2023-12-08',
    location: '上海 · 陆家嘴',
  },
  {
    id: 3,
    title: '手工披萨',
    description: '窑烤面饼与芝士拉丝，简单却治愈的一餐。',
    src: u('1565299624946-b28f40a0ae38', 500),
    srcLarge: u('1565299624946-b28f40a0ae38', 1200),
    category: 'food',
    date: '2024-02-14',
    location: '杭州 · 意式餐厅',
  },
  {
    id: 4,
    title: '晨雾森林',
    description: '热带雨林的晨雾与光束，仿佛走进绿野仙踪。',
    src: u('1470071459604-3b5ec3a7fe05', 500),
    srcLarge: u('1470071459604-3b5ec3a7fe05', 1200),
    category: 'landscape',
    date: '2023-10-20',
    location: '云南 · 西双版纳',
  },
  {
    id: 5,
    title: '天际线',
    description: '莲花山顶俯瞰深圳湾，城市与海洋的交界。',
    src: u('1480714378408-67cf0d13bc1b', 500),
    srcLarge: u('1480714378408-67cf0d13bc1b', 1200),
    category: 'city',
    date: '2023-11-03',
    location: '深圳 · 莲花山',
  },
  {
    id: 6,
    title: '精致甜点',
    description: '法式摆盘与季节水果，下午茶的小确幸。',
    src: u('1567620905732-2d1ec7ab7445', 500),
    srcLarge: u('1567620905732-2d1ec7ab7445', 1200),
    category: 'food',
    date: '2024-03-01',
    location: '北京 · 三里屯',
  },
  {
    id: 7,
    title: '窗边人像',
    description: '自然光下的肖像练习，柔和明暗过渡。',
    src: u('1506794778202-cad84cf45f1d', 500),
    srcLarge: u('1506794778202-cad84cf45f1d', 1200),
    category: 'portrait',
    date: '2024-02-02',
    location: '工作室',
  },
  {
    id: 8,
    title: '湖畔黄昏',
    description: '洱海边的金色时刻，远山与湖水融为一体。',
    src: u('1501785888041-af3ef285b470', 500),
    srcLarge: u('1501785888041-af3ef285b470', 1200),
    category: 'landscape',
    date: '2023-09-18',
    location: '大理 · 洱海',
  },
]

export const mockGalleryCategories: GalleryCategory[] = [
  { label: '全部', value: 'all' },
  { label: '风景', value: 'landscape' },
  { label: '城市', value: 'city' },
  { label: '美食', value: 'food' },
]

export const mockGalleryStats: GalleryStat[] = [
  { label: '总照片', value: '128' },
  { label: '本月新增', value: '12' },
  { label: '最常拍摄', value: '风景' },
]

export const mockGearList: GearItem[] = [
  {
    icon: 'lucide:camera',
    name: 'Sony A7M4',
    description: '主力相机',
  },
  {
    icon: 'lucide:circle',
    name: 'FE 24-70mm f/2.8',
    description: '常用镜头',
  },
  {
    icon: 'lucide:smartphone',
    name: 'iPhone 15 Pro',
    description: '随手拍',
  },
]
