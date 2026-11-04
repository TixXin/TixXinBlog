// @vitest-environment node
/**
 * @file clientChunking.test.ts
 * @description 生产客户端分块合并规则：外壳/主题分组、通用组资格（页面数、体积、依赖安全）、输出配置与块报告
 * @author TixXin
 * @since 2026-11-05
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  chunkReportPlugin,
  clientRolldownOutput,
  commonGroupName,
  publicPagesOf,
  reachesRoot,
  shellGroupName,
} from '../../clientChunking'

const ROOT = '/repo/src/frontend/web-blog'
const app = (path: string) => `${ROOT}/app/${path}`
const npm = (path: string) => `/repo/node_modules/.pnpm/x@1/node_modules/${path}`

interface Node {
  imports?: string[]
  code?: string
}

/** 由“模块 → 静态导入”描述构造打包器的模块信息查询，自动补全 importers */
function graph(nodes: Record<string, Node>) {
  const importers = new Map<string, string[]>()
  for (const [id, node] of Object.entries(nodes)) {
    for (const dep of node.imports ?? []) importers.set(dep, [...(importers.get(dep) ?? []), id])
  }
  return {
    getModuleInfo(id: string) {
      if (!(id in nodes) && !importers.has(id)) return null
      return {
        code: nodes[id]?.code ?? 'export {}',
        importers: importers.get(id) ?? [],
        importedIds: nodes[id]?.imports ?? [],
      }
    },
  }
}

const PAGES = ['index.vue', 'moments/index.vue', 'gallery.vue', 'about.vue'].map((page) => app(`pages/${page}`))

describe('外壳与主题分组', () => {
  const ctx = graph({
    [app('layouts/default.vue')]: { imports: [app('components/common/PageFrame.vue'), app('composables/useToast.ts')] },
    // 与真实构建一致：.vue 静态导入自身的样式子模块
    [app('components/common/PageFrame.vue')]: {
      imports: [
        npm('vue-router/dist/index.js'),
        `${app('components/common/PageFrame.vue')}?vue&type=style&index=0&lang.scss`,
      ],
    },
    [app('composables/useToast.ts')]: { imports: [npm('ofetch/dist/index.mjs')] },
    [app('plugins/site-settings.ts')]: { imports: [npm('@vue/shared/dist/index.js')] },
    [`${ROOT}/themes/nexus/app/components/StatusFooter.vue`]: { imports: [app('components/auth/AuthPanel.vue')] },
    [app('pages/guestbook.vue')]: { imports: [app('components/guestbook/Entry.vue')] },
    [app('pages/admin/site.vue')]: { imports: [app('components/admin/SiteForm.vue')] },
  })

  it('默认布局、插件与主题组件静态可达的模块按类别分四块', () => {
    expect(shellGroupName(npm('vue-router/dist/index.js'), ctx)).toBe('shell-vue')
    expect(shellGroupName(npm('@vue/shared/dist/index.js'), ctx)).toBe('shell-vue')
    expect(shellGroupName(npm('ofetch/dist/index.mjs'), ctx)).toBe('shell-vendor')
    expect(shellGroupName(app('components/common/PageFrame.vue'), ctx)).toBe('shell-components')
    expect(shellGroupName(app('layouts/default.vue'), ctx)).toBe('shell-components')
    expect(shellGroupName(app('composables/useToast.ts'), ctx)).toBe('shell-app')
    // 主题组件依赖的宿主模块进入外壳，主题源码自身归主题组
    expect(shellGroupName(app('components/auth/AuthPanel.vue'), ctx)).toBe('shell-components')
    expect(shellGroupName(`${ROOT}/themes/nexus/app/components/StatusFooter.vue`, ctx)).toBe('theme-nexus')
  })

  it('SFC 子模块按源文件归类', () => {
    expect(shellGroupName(`${app('components/common/PageFrame.vue')}?vue&type=style&index=0&lang.scss`, ctx)).toBe(
      'shell-components',
    )
  })

  it('只属于页面的模块、后台代码与虚拟模块不进外壳', () => {
    expect(shellGroupName(app('components/guestbook/Entry.vue'), ctx)).toBeNull()
    expect(shellGroupName(app('components/admin/SiteForm.vue'), ctx)).toBeNull()
    expect(shellGroupName(app('pages/admin/site.vue'), ctx)).toBeNull()
    expect(shellGroupName('\0vite/preload-helper.js', ctx)).toBeNull()
  })
})

describe('静态导入可达性', () => {
  it('沿 importers 向上查找根，环路能终止并缓存结果', () => {
    const a = app('utils/a.ts')
    const b = app('utils/b.ts')
    const ctx = graph({ [a]: { imports: [b] }, [b]: { imports: [a] } })
    const cache = new Map<string, boolean>()
    expect(reachesRoot(a, /layouts\/default\.vue$/, ctx, cache)).toBe(false)
    expect(cache.get(a)).toBe(false)
    const rooted = graph({
      [app('layouts/default.vue')]: { imports: [a] },
      [a]: { imports: [b] },
      [b]: { imports: [a] },
    })
    expect(reachesRoot(b, /layouts\/default\.vue$/, rooted, new Map())).toBe(true)
  })

  it('后台页面不计入公开页面', () => {
    const shared = app('utils/format.ts')
    const ctx = graph({
      [PAGES[0]]: { imports: [shared] },
      [app('pages/admin/index.vue')]: { imports: [shared] },
    })
    expect([...publicPagesOf(shared, ctx, new Map())]).toEqual([PAGES[0]])
  })
})

describe('通用组资格', () => {
  const usedBy = (count: number, id: string) =>
    Object.fromEntries(PAGES.slice(0, count).map((page) => [page, { imports: [id] }]))

  it('至少三个公开页面共用、体积不超过 4KB 且依赖合格时进入通用组', () => {
    const id = app('composables/useRelativeDate.ts')
    const dep = app('utils/format.ts')
    const ctx = graph({ ...usedBy(3, id), [id]: { imports: [dep] } })
    expect(commonGroupName(id, ctx)).toBe('common')
    expect(commonGroupName(dep, ctx)).toBe('common')
  })

  it('只被一两个页面使用时不合并', () => {
    const id = app('composables/useMomentStore.ts')
    expect(commonGroupName(id, graph({ ...usedBy(2, id), [id]: {} }))).toBeNull()
  })

  it('超过 4KB 的模块随页面分块', () => {
    const id = app('components/common/ImageFrame.vue')
    expect(commonGroupName(id, graph({ ...usedBy(4, id), [id]: { code: 'x'.repeat(4 * 1024 + 1) } }))).toBeNull()
  })

  it('依赖后台组件或页面专属组件时不合并，避免通用块反向引入它们', () => {
    const viaAdmin = app('features/media/picker.ts')
    const viaPage = app('components/sidebar/FlashCalendarCard.vue')
    const ctx = graph({
      ...usedBy(4, viaAdmin),
      ...Object.fromEntries(PAGES.map((page) => [page, { imports: [viaAdmin, viaPage] }])),
      [viaAdmin]: { imports: [app('components/admin/MediaPicker.vue')] },
      [viaPage]: { imports: [app('components/flash/FlashEditor.vue')] },
    })
    expect(commonGroupName(viaAdmin, ctx)).toBeNull()
    expect(commonGroupName(viaPage, ctx)).toBeNull()
  })

  it('依赖本身不合格（如体积超限）时，依赖它的模块也不合并', () => {
    const id = app('utils/markdownLinks.ts')
    const big = app('utils/markdownRender.ts')
    const ctx = graph({ ...usedBy(4, id), [id]: { imports: [big] }, [big]: { code: 'x'.repeat(5000) } })
    expect(commonGroupName(id, ctx)).toBeNull()
  })

  it('第三方依赖必须已在外壳闭包内', () => {
    const inShell = app('composables/useLocalClock.ts')
    const pageLevel = app('composables/useMomentMarkdown.ts')
    const ctx = graph({
      ...Object.fromEntries(PAGES.map((page) => [page, { imports: [inShell, pageLevel] }])),
      [app('layouts/default.vue')]: { imports: [npm('@vueuse/core/dist/index.js')] },
      [inShell]: { imports: [npm('@vueuse/core/dist/index.js')] },
      [pageLevel]: { imports: [npm('markdown-it/index.mjs')] },
    })
    expect(commonGroupName(inShell, ctx)).toBe('common')
    expect(commonGroupName(pageLevel, ctx)).toBeNull()
  })

  it('非通用目录、名称含 admin 的模块与虚拟模块不进入通用组', () => {
    const pageOnly = app('components/guestbook/Entry.vue')
    const adminNamed = app('composables/useAdminApi.ts')
    const ctx = graph({ ...Object.fromEntries(PAGES.map((page) => [page, { imports: [pageOnly, adminNamed] }])) })
    expect(commonGroupName(pageOnly, ctx)).toBeNull()
    expect(commonGroupName(adminNamed, ctx)).toBeNull()
    expect(commonGroupName('\0plugin-vue:export-helper', ctx)).toBeNull()
  })
})

describe('客户端输出配置', () => {
  it('开启严格执行顺序，图表库优先单独切分，合并组不连带捕获依赖', () => {
    const output = clientRolldownOutput()
    expect(output.strictExecutionOrder).toBe(true)
    const [charts, shell, common] = output.codeSplitting.groups
    expect(charts).toMatchObject({ name: 'charts', priority: 3, maxSize: 240 * 1024 })
    expect((charts!.test as RegExp).test(npm('echarts/lib/echarts.js'))).toBe(true)
    expect((charts!.test as RegExp).test(npm('zrender/lib/zrender.js'))).toBe(true)
    expect((charts!.test as RegExp).test(npm('vue-echarts/dist/index.js'))).toBe(false)
    expect(shell).toMatchObject({ priority: 2, includeDependenciesRecursively: false })
    expect(common).toMatchObject({ priority: 1, includeDependenciesRecursively: false })
  })
})

describe('块报告插件', () => {
  let dir = ''
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('只作用于客户端构建，输出块文件、字节数与相对 web-blog 的模块路径', () => {
    dir = mkdtempSync(join(tmpdir(), 'chunk-report-'))
    const target = join(dir, 'report.json')
    const plugin = chunkReportPlugin(target)
    expect(plugin.apply).toBe('build')
    expect(plugin.applyToEnvironment({ name: 'client' })).toBe(true)
    expect(plugin.applyToEnvironment({ name: 'ssr' })).toBe(false)
    plugin.generateBundle(undefined, {
      'a.js': {
        type: 'chunk',
        fileName: '_nuxt/a.js',
        code: '中文',
        isDynamicEntry: true,
        moduleIds: [app('app.vue')],
      },
      'a.css': { type: 'asset', fileName: '_nuxt/a.css' },
    })
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual([
      { file: '_nuxt/a.js', bytes: 6, entry: true, modules: ['app/app.vue'] },
    ])
  })
})
