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
  modules: ['@nuxtjs/color-mode', '@nuxt/icon', '@tixxin/nuxt-theme-engine'],
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
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap' },
      ],
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
    defaultTheme: 'classic',
    cookieKey: 'tixxin-blog-layout-theme',
    lazyLoadThemes: true,
    contractsEntry: '#theme-contracts',
    contractsImportId: '#theme-contracts',
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
