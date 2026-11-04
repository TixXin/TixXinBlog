/**
 * @file clientChunking.ts
 * @description 生产客户端构建的分块合并规则。默认分块会为每一种“被哪些异步入口共用”的组合单独拆块，
 *   公开页面首屏因此要请求几十个 4KB 以下的碎块。这里按依赖关系合并以下几类模块：
 *   - 外壳组（shell-*）：根组件、插件、默认布局与主题组件经静态导入可达的模块，每个公开页面都会用到，按类别分四块；
 *   - 主题组（theme-<名称>）：各主题目录下的源码按主题各合一块，只在该主题启用时加载；
 *   - 通用组（common）：至少 3 个公开页面共用、不在外壳闭包里的 4KB 以下通用组合函数、工具与通用组件，且其项目内静态依赖
 *     同样具备资格，保证通用块不会反过来引用页面块、带入后台或页面专属代码；
 *   - 图表组（charts）：订阅页使用的 echarts/zrender 按 240KB 切分，避免单块过大。
 *   只被个别页面使用的代码仍随页面分块，后台代码不参与合并。只作用于客户端生产构建，不影响 SSR 与 dev。
 *   设置环境变量 CHUNK_REPORT=<路径> 时额外输出块与模块对照表，供验收核对。
 * @author TixXin
 * @since 2026-11-05
 */
import { writeFileSync } from 'node:fs'

interface ModuleGraphInfo {
  code: string | null
  importers: readonly string[]
  importedIds: readonly string[]
}

interface ChunkingContext {
  getModuleInfo(moduleId: string): ModuleGraphInfo | null
}

/**
 * 外壳根：根组件、插件、默认布局与各主题组件。它们的静态依赖是每个公开页面首屏都要加载的代码；
 * 主题组件自身另归主题组，只有其依赖的宿主模块（如登录表单）进入外壳。
 */
const SHELL_ROOT =
  /[\\/]web-blog[\\/](?:app[\\/](?:app\.vue|layouts[\\/]default\.vue|plugins[\\/][^\\/]+)|themes[\\/][^\\/]+[\\/]app[\\/]components[\\/][^\\/]+\.vue)$/

/** 公开页面根：非后台的页面组件 */
const PUBLIC_PAGE_ROOT = /[\\/]web-blog[\\/]app[\\/]pages[\\/](?!admin[\\/])[^?]+\.vue$/

/** 后台代码：页面、布局与组件均保持原有分块 */
const ADMIN_SOURCE =
  /[\\/]web-blog[\\/]app[\\/](?:pages[\\/]admin[\\/]|components[\\/]admin[\\/]|layouts[\\/]admin\.vue)/

/** 主题源码目录，捕获主题名 */
const THEME_SOURCE = /[\\/]web-blog[\\/]themes[\\/]([^\\/]+)[\\/]/

/** 通用目录：宿主组合函数、工具、领域模块与通用组件；页面专属组件目录（留言、朋友圈等）不收 */
const COMMON_SOURCE =
  /[\\/]web-blog[\\/]app[\\/](?:composables|utils|features|components[\\/](?:common|blog|sidebar|auth|layout|theme))[\\/]/

const NODE_MODULES = /[\\/]node_modules[\\/]/

/** 图表库体积大且只有订阅页使用，单独按上限切分，避免出现超大单块 */
const CHART_LIBRARY = /[\\/]node_modules[\\/](?:echarts|zrender)[\\/]/

const CHART_MAX_SIZE = 240 * 1024
const COMMON_MAX_MODULE_SIZE = 4 * 1024
/** 至少被这么多个公开页面共用才进通用组，只属于一两个页面的模块继续随页面分块 */
const COMMON_MIN_PAGES = 3

/** 去掉 Vue SFC 子模块等查询串，得到源文件 id */
function fileOf(id: string): string {
  const index = id.indexOf('?')
  return index === -1 ? id : id.slice(0, index)
}

/** 判断模块能否沿静态导入链向上到达给定根；结果按模块缓存，环路以已访问集合截断 */
export function reachesRoot(id: string, root: RegExp, ctx: ChunkingContext, cache: Map<string, boolean>): boolean {
  const cached = cache.get(id)
  if (cached !== undefined) return cached
  const visited = new Set<string>([id])
  const queue = [id]
  let found = false
  while (queue.length && !found) {
    const current = queue.shift() as string
    if (root.test(current) || cache.get(current) === true) found = true
    for (const importer of ctx.getModuleInfo(current)?.importers ?? []) {
      if (visited.has(importer)) continue
      visited.add(importer)
      queue.push(importer)
    }
  }
  cache.set(id, found)
  return found
}

/** 收集模块沿静态导入链向上可达的公开页面根，结果按模块缓存 */
export function publicPagesOf(
  id: string,
  ctx: ChunkingContext,
  cache: Map<string, ReadonlySet<string>>,
): ReadonlySet<string> {
  const cached = cache.get(id)
  if (cached) return cached
  const pages = new Set<string>()
  const visited = new Set<string>([id])
  const queue = [id]
  while (queue.length) {
    const current = queue.shift() as string
    if (PUBLIC_PAGE_ROOT.test(current)) pages.add(current)
    for (const importer of ctx.getModuleInfo(current)?.importers ?? []) {
      if (visited.has(importer)) continue
      visited.add(importer)
      queue.push(importer)
    }
  }
  cache.set(id, pages)
  return pages
}

/** 通用目录下的非后台模块 */
function isCommonSource(id: string): boolean {
  const file = fileOf(id)
  return COMMON_SOURCE.test(file) && !ADMIN_SOURCE.test(file) && !/admin/i.test(file)
}

/**
 * 通用组资格：通用目录下、自身不超过 4KB、至少被 3 个公开页面共用，且每个项目内静态依赖同样具备资格。
 * 依赖也必须被收进通用组，否则通用块会反过来引用页面块（实测曾把闪念页与后台媒体组件带进首页）；
 * 依赖的第三方库必须本就在外壳闭包里，否则会把 markdown-it、dompurify 这类页面级依赖带进每个页面。
 */
export function isCommonEligible(id: string, ctx: ChunkingContext, caches: ChunkCaches): boolean {
  const cached = caches.common.get(id)
  if (cached !== undefined) return cached
  caches.common.set(id, true)
  const info = ctx.getModuleInfo(id)
  const eligible =
    isCommonSource(id) &&
    Buffer.byteLength(info?.code ?? '') <= COMMON_MAX_MODULE_SIZE &&
    publicPagesOf(id, ctx, caches.publicPage).size >= COMMON_MIN_PAGES &&
    (info?.importedIds ?? []).every(
      (dep) =>
        dep.startsWith('\0') ||
        (NODE_MODULES.test(dep) ? reachesRoot(dep, SHELL_ROOT, ctx, caches.shell) : isCommonEligible(dep, ctx, caches)),
    )
  caches.common.set(id, eligible)
  return eligible
}

interface ChunkCaches {
  shell: Map<string, boolean>
  publicPage: Map<string, ReadonlySet<string>>
  common: Map<string, boolean>
}

function createCaches(): ChunkCaches {
  return { shell: new Map(), publicPage: new Map(), common: new Map() }
}

/** 为模块选择外壳或主题组名；返回 null 表示不归这两组 */
export function shellGroupName(id: string, ctx: ChunkingContext, caches = createCaches()): string | null {
  if (id.startsWith('\0')) return null
  const file = fileOf(id)
  if (ADMIN_SOURCE.test(file)) return null
  const theme = THEME_SOURCE.exec(file)
  if (theme) return `theme-${theme[1]}`
  return reachesRoot(id, SHELL_ROOT, ctx, caches.shell) ? shellPart(file) : null
}

/** Vue 运行时及其路由、国际化库 */
const VUE_RUNTIME = /[\\/]node_modules[\\/](?:@vue|vue|vue-router|vue-i18n|@intlify)[\\/]/
/** 宿主组件 */
const HOST_COMPONENT = /[\\/]web-blog[\\/]app[\\/](?:components[\\/]|app\.vue$|layouts[\\/])/

/**
 * 外壳按类别确定地分成四块，各块均在 250KB 以内。不用 maxSize 自动切分：配合 strictExecutionOrder 时
 * 实测会切成二十多个 4–68KB 的碎块，抵消合并效果。
 */
function shellPart(file: string): string {
  if (VUE_RUNTIME.test(file)) return 'shell-vue'
  if (NODE_MODULES.test(file)) return 'shell-vendor'
  return HOST_COMPONENT.test(file) ? 'shell-components' : 'shell-app'
}

/** 通用组判定 */
export function commonGroupName(id: string, ctx: ChunkingContext, caches = createCaches()): string | null {
  if (id.startsWith('\0')) return null
  return isCommonEligible(id, ctx, caches) ? 'common' : null
}

/**
 * rolldown 客户端 output 配置。合并后块之间更容易出现循环引用，默认按块求值会让部分模块早于依赖执行
 * （实测首页报 “Invalid value used as weak map key”，水合中断），因此开启 strictExecutionOrder 按原始导入顺序初始化。
 * 合并组不连带捕获依赖：外壳组的依赖本身就在外壳闭包内，主题组只收主题目录，通用组已校验依赖，避免带入其他代码。
 */
export function clientRolldownOutput() {
  const caches = createCaches()
  return {
    strictExecutionOrder: true,
    codeSplitting: {
      groups: [
        { name: 'charts', test: CHART_LIBRARY, priority: 3, maxSize: CHART_MAX_SIZE },
        {
          name: (id: string, ctx: ChunkingContext) => shellGroupName(id, ctx, caches),
          priority: 2,
          includeDependenciesRecursively: false,
        },
        {
          name: (id: string, ctx: ChunkingContext) => commonGroupName(id, ctx, caches),
          priority: 1,
          includeDependenciesRecursively: false,
        },
      ],
    },
  }
}

interface ReportChunk {
  type: string
  fileName: string
  code?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  moduleIds?: string[]
  imports?: string[]
}

/**
 * 输出每个 JS 块的源码模块与静态导入的块，模块路径相对 web-blog 目录。
 * main 标记应用主入口；按 imports 闭包即可推算页面首屏必载的块，供 scripts/ci/check-client-chunks.mjs 检查。
 */
export function chunkReportPlugin(target: string) {
  return {
    name: 'tixxin:chunk-report',
    apply: 'build' as const,
    applyToEnvironment: (environment: { name: string }) => environment.name === 'client',
    generateBundle(_options: unknown, bundle: Record<string, ReportChunk>) {
      const chunks = Object.values(bundle)
        .filter((item) => item.type === 'chunk')
        .map((item) => ({
          file: item.fileName,
          bytes: Buffer.byteLength(item.code ?? ''),
          entry: Boolean(item.isEntry || item.isDynamicEntry),
          main: Boolean(item.isEntry),
          imports: item.imports ?? [],
          modules: (item.moduleIds ?? []).map((id) => id.replace(/^.*?[\\/]web-blog[\\/]/, '')),
        }))
      writeFileSync(target, JSON.stringify(chunks, null, 2))
    },
  }
}
