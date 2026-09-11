/**
 * @file nuxt.config.ts
 * @description Nuxt 应用配置文件，包含模块、样式、主题、图标等全局设置
 * @author TixXin
 * @since 2025-03-17
 */

import nexusHostConfig from './themes/nexus/theme.config'
import auroraHostConfig from './themes/aurora/theme.config'
import dockHostConfig from './themes/dock/theme.config'
import { readFileSync } from 'node:fs'

const startupGuard = readFileSync(new URL('./public/startup-guard.js', import.meta.url), 'utf8')

export default {
  // Nuxt 启动历史与清单预取的固定版本修正维护在仓库根目录 patches/。
  // 开发与生产构建使用独立中间目录，避免并行构建污染正在运行的 Vite 状态。
  buildDir: process.env.NODE_ENV === 'production' ? '.nuxt-production' : '.nuxt',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    port: 3456,
    // 开发服务仅监听本机；生产通过构建产物及容器入口提供服务
    host: '127.0.0.1',
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
      ],
      // 生产环境：在 hydration 之前检测 sessionStorage，为 <html> 添加 .visited class，
      // 使非首次访问直接隐藏 loading 覆盖层，消除闪烁。开发环境不注入，保证刷新可调试
      script: [
        { innerHTML: startupGuard, tagPosition: 'head' },
        ...(process.env.NODE_ENV === 'production'
          ? [
              {
                innerHTML:
                  "(function(){try{if(sessionStorage.getItem('tixxin-blog-visited')){document.documentElement.classList.add('visited')}}catch(e){}})();",
                tagPosition: 'head',
              },
            ]
          : []),
      ],
      noscript: [
        {
          tagPosition: 'bodyClose',
          innerHTML: '<style>.loading-screen:not(.loading-screen--force){display:none!important}</style>',
        },
      ],
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
    lazyLoadThemes: true,
    contractsEntry: '#theme-contracts',
    contractsImportId: '#theme-contracts',
  },
  runtimeConfig: {
    // 仅服务端使用，可在容器运行时通过 NUXT_API_BASE_URL 覆盖。
    apiBaseUrl: '',
    public: {
      siteUrl: 'https://tix.xin',
      analytics: {
        provider: '',
        siteId: '',
        scriptUrl: '',
      },
      // 构建期常量：dev 调试面板「环境」tab 显示用，prod 时面板被 tree-shake，字段闲置
      buildTime: new Date().toISOString(),
      nuxtVersion: '4',
      // 数据仓库切换：true=mock 实现；false=HTTP 实现（对接 server-main）
      // 环境变量 NUXT_PUBLIC_USE_MOCK_REPO=false 时走后端；详见 app/plugins/repositories.ts
      // 当前数据源边界见 docs/capability-map.md。
      useMockRepo: process.env.NUXT_PUBLIC_USE_MOCK_REPO === 'true',
      // 文章及评论可独立联调，未配置时兼容原有全局开关。
      postUseMockRepo: (process.env.NUXT_PUBLIC_POST_USE_MOCK_REPO ?? process.env.NUXT_PUBLIC_USE_MOCK_REPO) === 'true',
      // 后端 API 基址，如 http://localhost:3000/api/v1（useMockRepo=false 时必填）
      apiBaseUrl: '/api/v1',
    },
  },
  site: {
    url: 'https://tix.xin',
    name: 'TixXin Blog',
  },
  sitemap: {
    strictNuxtContentPaths: true,
    exclude: ['/admin', '/admin/**', '/_theme-engine-devtools'],
    sources: ['/api/__sitemap__/urls'],
    cacheMaxAgeSeconds: 0,
  },
  robots: {
    allow: '/',
    disallow: ['/admin/', '/_theme-engine-devtools'],
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
          '/admin': { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } },
          '/admin/**': { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } },
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
            // useMockRepo=false 时浏览器需直连后端 API，把 API origin 加入 connect-src 白名单
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
  hooks: {
    // 宿主能力在构建期序列化；客户端不直接导入未激活主题的配置模块。
    'app:templates': (app: { templates: Array<{ filename: string; getContents: () => string; write?: boolean }> }) => {
      app.templates.push({
        filename: 'theme-host.config.mjs',
        write: true,
        getContents: () =>
          `export const themeHostConfigs = ${JSON.stringify({
            nexus: nexusHostConfig,
            aurora: auroraHostConfig,
            dock: dockHostConfig,
          })}`,
      })
    },
    // 引擎在dev下强制注册全部主题别名，会把可选SFC样式纳入入口依赖。
    // 本项目统一通过ThemeComponent的动态注册表加载，不使用这些全局别名。
    'components:extend': (components: Array<{ filePath: string }>) => {
      for (let index = components.length - 1; index >= 0; index--) {
        if (components[index]?.filePath.replaceAll('\\', '/').includes('/themes/')) components.splice(index, 1)
      }
    },
    // 主题引擎当前版本无条件注册调试页，必须在页面解析完成后移出生产路由。
    'pages:resolved': (pages: Array<{ path: string }>) => {
      if (process.env.NODE_ENV !== 'production') return
      for (let index = pages.length - 1; index >= 0; index -= 1) {
        if (pages[index]?.path === '/_theme-engine-devtools') pages.splice(index, 1)
      }
    },
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/tokens" as *;',
        },
      },
    },
    // dev 期这些依赖在路由懒加载后才被发现，Vite 中途预打包会触发整页 reload；
    // 显式声明可让其在启动时一次性预打包（生产构建不受影响）
    optimizeDeps: {
      include: [
        'fuse.js',
        'markdown-it',
        'markdown-it-task-lists',
        'isomorphic-dompurify',
        'shiki',
        '@vueuse/integrations/useSortable',
      ],
    },
    // 1Panel 反代场景：外部域名 tix.xin -> 容器 localhost:3456
    // Vite 默认 allowedHosts 只放行 localhost，这里需显式放行自定义域名
    // 'all' 会关闭 DNS rebinding 防护，生产不走 dev server，dev 环境放开可接受
    server: {
      allowedHosts: ['tix.xin', '.tix.xin'],
    },
  },
}
