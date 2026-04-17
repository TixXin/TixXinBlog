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
    // 容器/反代场景：监听 0.0.0.0，否则 Vite 默认只绑 127.0.0.1，外部/反代无法接入
    host: '0.0.0.0',
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
      link: [
        { rel: 'alternate', type: 'application/rss+xml', title: 'TixXin Blog RSS', href: '/rss.xml' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'TixXin 朋友圈 RSS', href: '/moments.xml' },
      ],
      // 生产环境：在 hydration 之前检测 sessionStorage，为 <html> 添加 .visited class，
      // 使非首次访问直接隐藏 loading 覆盖层，消除闪烁。开发环境不注入，保证刷新可调试
      script:
        process.env.NODE_ENV === 'production'
          ? [
              {
                innerHTML:
                  "(function(){try{if(sessionStorage.getItem('tixxin-blog-visited')){document.documentElement.classList.add('visited')}}catch(e){}})();",
                tagPosition: 'head',
              },
            ]
          : [],
    },
  },
  icon: {
    serverBundle: 'local',
    // 客户端 bundle：构建期静态扫描所有 <Icon name="..." /> 字面量并打入 JS bundle，
    // 消除运行时 /api/_nuxt_icon/lucide.json?icons=... 请求（节省一次 RTT）
    // 注意：动态 :name="dynamicVar" 不会被识别，必要时用下面 icons 字段补齐
    clientBundle: {
      scan: true,
      // 防御：未压缩 client bundle 上限 256KB，超过则构建报错
      sizeLimitKb: 256,
    },
  },
  colorMode: {
    classSuffix: '', // html 上直接加 class="dark"，与原型一致
    preference: 'dark',
    fallback: 'dark',
  },
  // NuxtLink prefetch 策略：默认 visibility（链接进入视口即预取），导致首页
  // 11 篇文章卡片挂载后挨个预取 /articles/N/_payload.json + 各路由 CSS/JS 共 ~350KB
  // 改为 interaction 模式：仅在 hover/focus 时触发，命中延迟 50-100ms 但首屏请求数大幅下降
  experimental: {
    defaults: {
      nuxtLink: {
        prefetchOn: { interaction: true },
      },
    },
  },
  themeEngine: {
    themesDir: './themes',
    defaultTheme: 'nexus',
    cookieKey: 'tixxin-blog-layout-theme',
    lazyLoadThemes: false,
    contractsEntry: '#theme-contracts',
    contractsImportId: '#theme-contracts',
  },
  runtimeConfig: {
    public: {
      analytics: {
        provider: '',
        siteId: '',
        scriptUrl: '',
      },
      // 构建期常量：dev 调试面板「环境」tab 显示用，prod 时面板被 tree-shake，字段闲置
      buildTime: new Date().toISOString(),
      nuxtVersion: '4',
      // 数据仓库切换：true=LocalStorage mock 实现；false=HTTP 实现（待后端就绪）
      // 详见 app/plugins/repositories.ts
      useMockRepo: true,
    },
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
    // 单 provider 模式：仅初始化 bunny，跳过 google/googleicons 等其他内置 provider
    // 避免服务器无网络环境下启动时卡 30s 拉取 fonts.google.com 元数据并报红
    provider: 'bunny',
    // 字重精简：移除未使用的 300（grep 确认 0 处使用），保留 400/500/600/700/800
    // 每个权重对应一个独立 WOFF2 文件，少一个权重 ≈ 减 24KB 字体下载
    families: [{ name: 'Inter', weights: [400, 500, 600, 700, 800] }],
    defaults: {
      fallbacks: ['system-ui', 'sans-serif'],
    },
  },
  routeRules: {
    // /articles 独立列表已与首页 / 合并，统一重定向到首页
    '/articles': { redirect: '/' },
    ...(process.env.NODE_ENV === 'production'
      ? {
          '/': { prerender: true },
          '/about': { prerender: true },
          '/links': { prerender: true },
          '/projects': { prerender: true },
          '/articles/**': { isr: 3600 },
        }
      : {}),
  },
  nitro: {
    compressPublicAssets: true,
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
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
    // 1Panel 反代场景：外部域名 tix.xin -> 容器 localhost:3456
    // Vite 默认 allowedHosts 只放行 localhost，这里需显式放行自定义域名
    // 'all' 会关闭 DNS rebinding 防护，生产不走 dev server，dev 环境放开可接受
    server: {
      allowedHosts: ['tix.xin', '.tix.xin'],
    },
  },
}
