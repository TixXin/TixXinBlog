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
  { name: '常用', icon: 'lucide:star', color: '#f59e0b' },
  { name: '工具', icon: 'lucide:wrench', color: '#3b82f6' },
  { name: '学习', icon: 'lucide:book-open', color: '#8b5cf6' },
  { name: '灵感', icon: 'lucide:lightbulb', color: '#ec4899' },
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
  // 常用
  { categoryName: '常用', name: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285f4' },
  { categoryName: '常用', name: 'GitHub', url: 'https://github.com', icon: 'lucide:github', color: '#24292f' },
  { categoryName: '常用', name: 'YouTube', url: 'https://www.youtube.com', icon: 'lucide:youtube', color: '#ff0000' },
  { categoryName: '常用', name: 'Twitter', url: 'https://twitter.com', icon: 'lucide:twitter', color: '#1da1f2' },

  // 工具
  { categoryName: '工具', name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'lucide:bot', color: '#10a37f' },
  { categoryName: '工具', name: 'Figma', url: 'https://www.figma.com', icon: 'lucide:figma', color: '#a259ff' },
  { categoryName: '工具', name: 'Notion', url: 'https://www.notion.so', icon: 'N', color: '#000000' },
  { categoryName: '工具', name: 'CodePen', url: 'https://codepen.io', icon: 'lucide:codepen', color: '#1e1f26' },

  // 学习
  { categoryName: '学习', name: 'MDN', url: 'https://developer.mozilla.org', icon: 'M', color: '#000000' },
  { categoryName: '学习', name: 'Vue.js', url: 'https://vuejs.org', icon: 'V', color: '#42b883' },
  { categoryName: '学习', name: 'Nuxt', url: 'https://nuxt.com', icon: 'N', color: '#00dc82' },

  // 灵感
  { categoryName: '灵感', name: 'Dribbble', url: 'https://dribbble.com', icon: 'lucide:dribbble', color: '#ea4c89' },
]
