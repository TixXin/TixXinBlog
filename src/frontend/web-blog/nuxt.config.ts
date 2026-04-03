/**
 * @file nuxt.config.ts
 * @description Nuxt 应用配置文件，包含模块、样式、主题、图标等全局设置
 * @author TixXin
 * @since 2025-03-17
 */

export default {
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    port: 3456,
  },
  alias: {
    '#theme-contracts': './theme-contracts/index.ts',
  },
  modules: [
    '@nuxtjs/color-mode',
    '@nuxt/icon',
    '@tixxin/nuxt-theme-engine',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/image',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
  ],
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      titleTemplate: '%s - TixXin Blog',
      meta: [
        { name: 'description', content: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔' },
        { property: 'og:site_name', content: 'TixXin Blog' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'zh_CN' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@TixXin' },
      ],
      link: [],
    },
  },
  icon: {
    serverBundle: 'local',
  },
  colorMode: {
    classSuffix: '',       // html 上直接加 class="dark"，与原型一致
    preference: 'dark',
    fallback: 'dark',
  },
  themeEngine: {
    themesDir: './themes',
    defaultTheme: 'nexus',
    cookieKey: 'tixxin-blog-layout-theme',
    lazyLoadThemes: true,
    contractsEntry: '#theme-contracts',
    contractsImportId: '#theme-contracts',
  },
  site: {
    url: 'https://tix.xin',
    name: 'TixXin Blog',
  },
  sitemap: {
    strictNuxtContentPaths: true,
  },
  robots: {
    allow: '/',
  },
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [300, 400, 500, 600, 700, 800] },
    ],
    defaults: {
      fallbacks: ['system-ui', 'sans-serif'],
    },
  },
  // routeRules 在生产部署时启用，开发模式下 payload 缓存目录不自动创建会导致 ENOENT
  // routeRules: {
  //   '/': { prerender: true },
  //   '/about': { prerender: true },
  //   '/links': { prerender: true },
  //   '/projects': { prerender: true },
  //   '/articles': { isr: 3600 },
  //   '/articles/**': { isr: 3600 },
  // },
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
    },
  },
  css: ['~/assets/styles/main.scss'],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/tokens" as *;',
        },
      },
    },
  },
}
