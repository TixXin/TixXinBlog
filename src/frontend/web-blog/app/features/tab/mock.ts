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
  { name: '娱乐', icon: 'lucide:music', color: '' },
  { name: '游戏', icon: 'lucide:gamepad-2', color: '' },
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
  // ==================== 主页（30+） ====================
  { categoryName: '主页', name: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285f4' },
  { categoryName: '主页', name: 'GitHub', url: 'https://github.com', icon: 'lucide:github', color: '#24292f' },
  { categoryName: '主页', name: 'YouTube', url: 'https://www.youtube.com', icon: 'lucide:youtube', color: '#ff0000' },
  { categoryName: '主页', name: 'Twitter', url: 'https://twitter.com', icon: 'lucide:twitter', color: '#1da1f2' },
  { categoryName: '主页', name: 'Gmail', url: 'https://mail.google.com', icon: 'lucide:mail', color: '#ea4335' },
  { categoryName: '主页', name: 'Reddit', url: 'https://www.reddit.com', icon: 'R', color: '#ff4500' },
  { categoryName: '主页', name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'W', color: '#333333' },
  { categoryName: '主页', name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'S', color: '#f48024' },
  { categoryName: '主页', name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'B', color: '#00a1d6' },
  { categoryName: '主页', name: '知乎', url: 'https://www.zhihu.com', icon: '知', color: '#0084ff' },
  { categoryName: '主页', name: '微博', url: 'https://weibo.com', icon: '微', color: '#e6162d' },
  { categoryName: '主页', name: 'V2EX', url: 'https://www.v2ex.com', icon: 'V', color: '#333333' },
  { categoryName: '主页', name: '掘金', url: 'https://juejin.cn', icon: '掘', color: '#1e80ff' },
  { categoryName: '主页', name: 'Notion', url: 'https://www.notion.so', icon: 'N', color: '#000000' },
  { categoryName: '主页', name: 'Figma', url: 'https://www.figma.com', icon: 'lucide:figma', color: '#a259ff' },
  { categoryName: '主页', name: 'Vercel', url: 'https://vercel.com', icon: '▲', color: '#000000' },
  { categoryName: '主页', name: 'Netlify', url: 'https://www.netlify.com', icon: 'N', color: '#00c7b7' },
  { categoryName: '主页', name: 'Cloudflare', url: 'https://www.cloudflare.com', icon: 'C', color: '#f38020' },
  { categoryName: '主页', name: 'NPM', url: 'https://www.npmjs.com', icon: 'N', color: '#cb3837' },
  { categoryName: '主页', name: 'MDN', url: 'https://developer.mozilla.org', icon: 'M', color: '#000000' },
  { categoryName: '主页', name: 'Can I Use', url: 'https://caniuse.com', icon: 'C', color: '#263238' },
  { categoryName: '主页', name: 'Google Maps', url: 'https://maps.google.com', icon: 'lucide:map', color: '#34a853' },
  { categoryName: '主页', name: 'Google Drive', url: 'https://drive.google.com', icon: 'lucide:hard-drive', color: '#4285f4' },
  { categoryName: '主页', name: 'Amazon', url: 'https://www.amazon.com', icon: 'A', color: '#ff9900' },
  { categoryName: '主页', name: 'LinkedIn', url: 'https://www.linkedin.com', icon: 'lucide:linkedin', color: '#0a66c2' },
  { categoryName: '主页', name: 'Discord', url: 'https://discord.com', icon: 'D', color: '#5865f2' },
  { categoryName: '主页', name: 'Slack', url: 'https://slack.com', icon: 'lucide:slack', color: '#4a154b' },
  { categoryName: '主页', name: 'Medium', url: 'https://medium.com', icon: 'M', color: '#000000' },
  { categoryName: '主页', name: 'Dev.to', url: 'https://dev.to', icon: 'D', color: '#0a0a0a' },
  { categoryName: '主页', name: 'Product Hunt', url: 'https://www.producthunt.com', icon: 'P', color: '#da552f' },
  { categoryName: '主页', name: 'Hacker News', url: 'https://news.ycombinator.com', icon: 'Y', color: '#ff6600' },
  { categoryName: '主页', name: 'Twitch', url: 'https://www.twitch.tv', icon: 'lucide:twitch', color: '#9146ff' },

  // ==================== AI ====================
  { categoryName: 'AI', name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'lucide:bot', color: '#10a37f' },
  { categoryName: 'AI', name: 'Claude', url: 'https://claude.ai', icon: 'lucide:sparkles', color: '#d4a574' },
  { categoryName: 'AI', name: 'Midjourney', url: 'https://www.midjourney.com', icon: 'M', color: '#000000' },
  { categoryName: 'AI', name: 'Gemini', url: 'https://gemini.google.com', icon: 'G', color: '#4285f4' },
  { categoryName: 'AI', name: 'Perplexity', url: 'https://www.perplexity.ai', icon: 'P', color: '#20808d' },
  { categoryName: 'AI', name: 'HuggingFace', url: 'https://huggingface.co', icon: 'H', color: '#ffbd45' },
  { categoryName: 'AI', name: 'Stable Diffusion', url: 'https://stability.ai', icon: 'S', color: '#7c3aed' },
  { categoryName: 'AI', name: 'Poe', url: 'https://poe.com', icon: 'P', color: '#6c5ce7' },
  { categoryName: 'AI', name: 'Cursor', url: 'https://cursor.com', icon: 'C', color: '#000000' },
  { categoryName: 'AI', name: 'Copilot', url: 'https://copilot.microsoft.com', icon: 'C', color: '#0078d4' },

  // ==================== 程序员 ====================
  { categoryName: '程序员', name: 'Vue.js', url: 'https://vuejs.org', icon: 'V', color: '#42b883' },
  { categoryName: '程序员', name: 'Nuxt', url: 'https://nuxt.com', icon: 'N', color: '#00dc82' },
  { categoryName: '程序员', name: 'React', url: 'https://react.dev', icon: 'R', color: '#61dafb' },
  { categoryName: '程序员', name: 'Next.js', url: 'https://nextjs.org', icon: 'N', color: '#000000' },
  { categoryName: '程序员', name: 'TypeScript', url: 'https://www.typescriptlang.org', icon: 'T', color: '#3178c6' },
  { categoryName: '程序员', name: 'Tailwind CSS', url: 'https://tailwindcss.com', icon: 'T', color: '#06b6d4' },
  { categoryName: '程序员', name: 'Vite', url: 'https://vitejs.dev', icon: 'V', color: '#646cff' },
  { categoryName: '程序员', name: 'CodePen', url: 'https://codepen.io', icon: 'lucide:codepen', color: '#1e1f26' },
  { categoryName: '程序员', name: 'Docker Hub', url: 'https://hub.docker.com', icon: 'D', color: '#2496ed' },
  { categoryName: '程序员', name: 'Rust', url: 'https://www.rust-lang.org', icon: 'R', color: '#000000' },
  { categoryName: '程序员', name: 'Go', url: 'https://go.dev', icon: 'G', color: '#00add8' },
  { categoryName: '程序员', name: 'Python', url: 'https://python.org', icon: 'P', color: '#3776ab' },

  // ==================== 设计 ====================
  { categoryName: '设计', name: 'Dribbble', url: 'https://dribbble.com', icon: 'lucide:dribbble', color: '#ea4c89' },
  { categoryName: '设计', name: 'Behance', url: 'https://www.behance.net', icon: 'B', color: '#1769ff' },
  { categoryName: '设计', name: 'Unsplash', url: 'https://unsplash.com', icon: 'U', color: '#000000' },
  { categoryName: '设计', name: 'Pinterest', url: 'https://www.pinterest.com', icon: 'P', color: '#e60023' },
  { categoryName: '设计', name: 'Coolors', url: 'https://coolors.co', icon: 'C', color: '#0a84ff' },
  { categoryName: '设计', name: 'Font Awesome', url: 'https://fontawesome.com', icon: 'F', color: '#228ae6' },
  { categoryName: '设计', name: 'Google Fonts', url: 'https://fonts.google.com', icon: 'G', color: '#4285f4' },
  { categoryName: '设计', name: 'Lucide Icons', url: 'https://lucide.dev', icon: 'L', color: '#f56565' },

  // ==================== 产品 ====================
  { categoryName: '产品', name: 'Product Hunt', url: 'https://www.producthunt.com', icon: 'P', color: '#da552f' },
  { categoryName: '产品', name: 'Indie Hackers', url: 'https://www.indiehackers.com', icon: 'I', color: '#0e4d92' },
  { categoryName: '产品', name: 'Stripe', url: 'https://stripe.com', icon: 'S', color: '#635bff' },
  { categoryName: '产品', name: 'Linear', url: 'https://linear.app', icon: 'L', color: '#5e6ad2' },
  { categoryName: '产品', name: 'Jira', url: 'https://www.atlassian.com/software/jira', icon: 'J', color: '#0052cc' },
  { categoryName: '产品', name: 'Analytics', url: 'https://analytics.google.com', icon: 'lucide:bar-chart', color: '#e37400' },

  // ==================== 娱乐 ====================
  { categoryName: '娱乐', name: 'Netflix', url: 'https://www.netflix.com', icon: 'N', color: '#e50914' },
  { categoryName: '娱乐', name: 'Spotify', url: 'https://open.spotify.com', icon: 'S', color: '#1db954' },
  { categoryName: '娱乐', name: '网易云音乐', url: 'https://music.163.com', icon: '云', color: '#c20c0c' },
  { categoryName: '娱乐', name: '豆瓣', url: 'https://www.douban.com', icon: '豆', color: '#007722' },
  { categoryName: '娱乐', name: '优酷', url: 'https://www.youku.com', icon: '优', color: '#1ebeff' },
  { categoryName: '娱乐', name: '抖音', url: 'https://www.douyin.com', icon: '抖', color: '#000000' },
  { categoryName: '娱乐', name: '小红书', url: 'https://www.xiaohongshu.com', icon: '红', color: '#fe2c55' },

  // ==================== 游戏 ====================
  { categoryName: '游戏', name: 'Steam', url: 'https://store.steampowered.com', icon: 'S', color: '#1b2838' },
  { categoryName: '游戏', name: 'Epic Games', url: 'https://store.epicgames.com', icon: 'E', color: '#000000' },
  { categoryName: '游戏', name: 'IGN', url: 'https://www.ign.com', icon: 'I', color: '#bf1313' },
  { categoryName: '游戏', name: '3DM', url: 'https://www.3dmgame.com', icon: '3', color: '#00a0e9' },
  { categoryName: '游戏', name: 'NGA', url: 'https://bbs.nga.cn', icon: 'N', color: '#7b8d42' },
  { categoryName: '游戏', name: 'TapTap', url: 'https://www.taptap.cn', icon: 'T', color: '#00c4b3' },
]
