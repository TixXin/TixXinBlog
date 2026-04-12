/**
 * @file mock.ts
 * @description 标签页默认分类与示例书签，仅在用户首次访问且数据为空时注入
 * @author TixXin
 * @since 2026-04-11
 *
 * 这些 seed 数据通过 useTabBookmarks 在客户端 onMounted 时按需写入 localStorage。
 * 后端就绪后，HttpTabRepository 会从服务端拉取真实数据，这份 seed 自然废弃。
 */

import type { BookmarkCategoryDraft, BookmarkDraft } from './types'

/** 默认分类草稿 */
export const defaultCategorySeeds: BookmarkCategoryDraft[] = [
  { name: '主页', icon: 'lucide:home', color: '' },
  { name: 'AI', icon: 'lucide:sparkles', color: '' },
  { name: '程序员', icon: 'lucide:terminal', color: '' },
  { name: '设计', icon: 'lucide:palette', color: '' },
  { name: '产品', icon: 'lucide:box', color: '' },
  { name: '服务器', icon: 'lucide:server', color: '' },
  { name: '摸鱼', icon: 'lucide:fish', color: '' },
]

/**
 * 默认书签草稿（按分类名分组）。useTabBookmarks 会在 seed 时把 categoryName
 * 替换为实际生成的 categoryId。
 */
export interface BookmarkSeed extends Omit<BookmarkDraft, 'categoryId'> {
  /** 分类名（与 defaultCategorySeeds.name 对齐） */
  categoryName: string
}

export const defaultBookmarkSeeds: BookmarkSeed[] = [
  // 主页
  { categoryName: '主页', name: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285f4' },
  { categoryName: '主页', name: 'GitHub', url: 'https://github.com', icon: 'lucide:github', color: '#24292f' },
  { categoryName: '主页', name: 'YouTube', url: 'https://www.youtube.com', icon: 'lucide:youtube', color: '#ff0000' },
  { categoryName: '主页', name: 'Twitter', url: 'https://twitter.com', icon: 'lucide:twitter', color: '#1da1f2' },

  // AI
  { categoryName: 'AI', name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'lucide:bot', color: '#10a37f' },
  { categoryName: 'AI', name: 'Claude', url: 'https://claude.ai', icon: 'lucide:sparkles', color: '#d4a574' },
  { categoryName: 'AI', name: 'Midjourney', url: 'https://www.midjourney.com', icon: 'M', color: '#000000' },

  // 程序员
  { categoryName: '程序员', name: 'MDN', url: 'https://developer.mozilla.org', icon: 'M', color: '#000000' },
  { categoryName: '程序员', name: 'Vue.js', url: 'https://vuejs.org', icon: 'V', color: '#42b883' },
  { categoryName: '程序员', name: 'Nuxt', url: 'https://nuxt.com', icon: 'N', color: '#00dc82' },
  { categoryName: '程序员', name: 'CodePen', url: 'https://codepen.io', icon: 'lucide:codepen', color: '#1e1f26' },

  // 设计
  { categoryName: '设计', name: 'Figma', url: 'https://www.figma.com', icon: 'lucide:figma', color: '#a259ff' },
  { categoryName: '设计', name: 'Dribbble', url: 'https://dribbble.com', icon: 'lucide:dribbble', color: '#ea4c89' },

  // 摸鱼
  { categoryName: '摸鱼', name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'B', color: '#00a1d6' },
  { categoryName: '摸鱼', name: 'V2EX', url: 'https://www.v2ex.com', icon: 'V', color: '#333333' },
]
