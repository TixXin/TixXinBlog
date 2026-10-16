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
  // prepare/typecheck 也可能使用 production；默认目录需与 ESLint 和根 tsconfig 的引用保持一致。
  buildDir: '.nuxt',
  // 项目 build/generate 命令显式选择该环境，生产构建不会改写日常开发的 Vite 中间文件。
  $env: {
    'production-build': {
      buildDir: '.nuxt-production',
      // 站点模块默认把 envName 当作发布环境；构建目录名称不应导致正式站点被禁止索引。
      site: { env: 'production' },
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NUXT_DEVTOOLS_ENABLED === 'true' },
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
      // 以下三项只是站点资料未就绪时的 SSR 首屏兜底；正式值由博主在 /admin/site 维护，
      // 由 app.vue 的 useHead/useSeoMeta 动态覆盖。此处不放任何具体站点的身份信息。
      titleTemplate: '%s - My Blog',
      meta: [
        { name: 'description', content: '' },
        { property: 'og:site_name', content: 'My Blog' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'zh_CN' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      // 在 hydration 之前检测 sessionStorage，为 <html> 添加 .visited class，
      // 使非首次访问直接隐藏 loading 覆盖层，消除闪烁。开发与生产一致；调试时加 ?splash=1 强制显示
      script: [
        { innerHTML: startupGuard, tagPosition: 'head' },
        {
          innerHTML:
            "(function(){try{if(sessionStorage.getItem('tixxin-blog-visited')&&!/[?&]splash=1(?:&|$)/.test(location.search)){document.documentElement.classList.add('visited')}}catch(e){}})();",
          tagPosition: 'head',
        },
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
  // NuxtLink prefetch 策略：此处配置会与 Nuxt 默认的 visibility: true 深合并，
  // 因此可见即预取始终生效；生产下这只是在空闲时预载各栏目的路由块（HTTP/2，约数百 KB），
  // 换来切页免等代码加载。hover/focus 预取作为补充。dev 下 Nuxt 不预载路由块，
  // 悬停预取由 plugins/route-prefetch.client.ts 单独处理。
  experimental: {
    // 关闭 payload 提取：Nuxt 会把带缓存规则的路由当作可预取 payload 的页面，每个可见链接都会让
    // 服务端完整渲染一次目标页并打一轮后端接口，瞬间触发后端限流。本站不预渲染，客户端切页走接口即可。
    payloadExtraction: false,
    defaults: {
      nuxtLink: {
        prefetchOn: { visibility: true, interaction: true },
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
    // 仅信任实际前置代理的地址/CIDR，默认忽略访客提交的转发头。
    trustedProxyCidrs: '',
    public: {
      // 公开站点地址，部署时由 NUXT_PUBLIC_SITE_URL 注入；默认值仅供本机开发。
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3456',
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
      // 当前数据源边界见 docs/content.md。
      useMockRepo: process.env.NUXT_PUBLIC_USE_MOCK_REPO === 'true',
      // 文章及评论可独立联调，未配置时兼容原有全局开关。
      postUseMockRepo: (process.env.NUXT_PUBLIC_POST_USE_MOCK_REPO ?? process.env.NUXT_PUBLIC_USE_MOCK_REPO) === 'true',
      // 后端 API 基址，如 http://localhost:3457/api/v1（useMockRepo=false 时必填）
      apiBaseUrl: '/api/v1',
    },
  },
  // sitemap 与 robots 的构建期站点标识；地址由部署环境经 NUXT_PUBLIC_SITE_URL 注入。
  // 不写死兜底地址：本机开发时该变量为 localhost，nuxt-site-config 会提示其不适合作为公开地址，
  // 属预期现象，生产注入正式域名后不再出现。
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL,
    name: 'My Blog',
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
    // 子集只保留拉丁字符：中文走系统字体，cyrillic/greek/vietnamese 子集只会膨胀 @font-face 声明与内联 CSS
    // 不下载斜体：站内少量 italic 由浏览器合成，省掉一半字体文件
    families: [
      { name: 'Inter', weights: [400, 500, 600, 700, 800], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    ],
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
          // 公开页面的 SSR HTML 在服务端缓存 60s（stale-while-revalidate）：SSR 本就是匿名视图，
          // 登录态在客户端恢复；按 cookie 区分键，布局主题 cookie 不同的访客各自一份。
          // 经本站代理的写请求会清空该缓存（server/plugins/ssr-cache-purge.ts），内容变更不等 60s。
          ...Object.fromEntries(
            [
              '/',
              '/archive',
              '/moments',
              '/moments/**',
              '/projects',
              '/gallery',
              '/flash',
              '/flash/**',
              '/links',
              '/guestbook',
              '/about',
              '/prompts',
              '/subscriptions',
              '/tabs',
              '/articles/**',
            ].map((path) => [path, { cache: { maxAge: 60, swr: true, varies: ['cookie'] } }]),
          ),
        }
      : {}),
  },
  nitro: {
    // 服务端与项目 Node 25 运行基线一致，保留金额精确聚合所需的 BigInt。
    esbuild: { options: { target: 'node25' } },
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
  features: {
    // 组件样式改为外链 CSS：首页 HTML 少 100KB 以上，样式文件带内容哈希可长期缓存，回访只传 HTML
    inlineStyles: false,
  },
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
    // 共用纯领域包保留 CommonJS 供 Nest/Jest 使用，浏览器构建显式转换工作区源码。
    build: {
      commonjsOptions: { include: [/node_modules/, /subscription-domain/] },
    },
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
        '@tixxin/subscription-domain',
        'fuse.js',
        'markdown-it',
        'markdown-it-task-lists',
        'isomorphic-dompurify',
        'shiki',
        '@vueuse/integrations/useSortable',
      ],
    },
    // 反代场景：外部域名 -> 容器 localhost:3456
    // Vite 默认 allowedHosts 只放行 localhost，自定义域名需经 NUXT_DEV_ALLOWED_HOSTS 显式放行，
    // 逗号分隔，例如 example.com,.example.com；留空表示只放行 localhost
    // 'all' 会关闭 DNS rebinding 防护，生产不走 dev server，dev 环境放开可接受
    server: {
      allowedHosts: (process.env.NUXT_DEV_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
      // dev 启动即预转换全部页面、布局与主题壳层（含其静态依赖图），首屏与切页不再逐个按需转换数百个模块
      warmup: {
        clientFiles: [
          './app/app.vue',
          './app/layouts/*.vue',
          './app/pages/**/*.vue',
          './themes/*/app/components/*.vue',
        ],
      },
    },
  },
}
