/**
 * @file site.ts
 * @description 站点配置文件 — fork 用户修改此文件即可自定义博客身份信息
 * @author TixXin
 * @since 2026-04-06
 */

export const siteConfig = {
  /** 站点名称 */
  name: 'TixXin Blog',

  /** 站点 URL（用于 RSS、OG 标签、sitemap 等） */
  url: 'https://tix.xin',

  /** 作者信息 */
  author: {
    name: 'TixXin',
    url: 'https://tixxin.dev',
  },

  /** 站点描述 */
  description: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',

  /** 社交账号（用于 SEO meta 和页脚） */
  social: {
    twitter: '@TixXin',
    github: 'TixXin',
  },

  /** 功能开关 */
  features: {
    /** RSS 订阅 */
    rss: true,
    /** Newsletter 邮件订阅 */
    newsletter: true,
    /** 统计分析（在 nuxt.config.ts 的 runtimeConfig 中配置具体参数） */
    analytics: true,
  },
} as const
