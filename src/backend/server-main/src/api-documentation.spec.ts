/**
 * @file api-documentation.spec.ts
 * @description 从控制器装饰器元数据核对 API 文档，不实例化应用、服务或数据库连接。
 */
import 'reflect-metadata'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Controller, Get, Post as HttpPost, RequestMethod } from '@nestjs/common'
import { CONTROLLER_WATERMARK, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { MetadataScanner } from '@nestjs/core/metadata-scanner'

// AuthService 导入时会预计算密码哈希；仅隔离这项与路由无关的异步工作，保留真实控制器和装饰器。
jest.mock('argon2', () => ({
  ...jest.requireActual<typeof import('argon2')>('argon2'),
  hash: jest.fn().mockResolvedValue('metadata-only-password-hash'),
}))

type ControllerClass = { prototype: Record<string, unknown> }

/** 递归发现控制器文件，新增模块无需维护一份手工导入清单。 */
function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return controllerFiles(path)
      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [path] : []
    })
    .sort()
}

function isController(value: unknown): value is ControllerClass {
  return typeof value === 'function' && Reflect.getMetadata(CONTROLLER_WATERMARK, value) === true
}

function paths(metadata: unknown): string[] {
  if (typeof metadata === 'string') return [metadata]
  if (Array.isArray(metadata) && metadata.length > 0 && metadata.every((path) => typeof path === 'string')) {
    return metadata as string[]
  }
  throw new Error('控制器或方法缺少有效的路径元数据')
}

/** 与文档相同，业务路由省略全局前缀；健康探针本身没有该前缀。 */
function controllerRoutes(exports: Record<string, unknown>): Set<string> {
  const routes = new Set<string>()
  const scanner = new MetadataScanner()
  const controllers = Object.values(exports).filter(isController)
  if (controllers.length === 0) throw new Error('控制器文件没有导出带 @Controller 元数据的类')

  for (const controller of controllers) {
    const prefixes = paths(Reflect.getMetadata(PATH_METADATA, controller))
    for (const name of scanner.getAllMethodNames(controller.prototype)) {
      const handler = controller.prototype[name]
      if (typeof handler !== 'function') continue
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined
      if (method === undefined) continue
      if (typeof RequestMethod[method] !== 'string') throw new Error(`未知的 HTTP 方法元数据：${method}`)
      for (const prefix of prefixes) {
        for (const path of paths(Reflect.getMetadata(PATH_METADATA, handler))) {
          const joined = [prefix, path]
            .map((part) => part.replace(/^\/+|\/+$/g, ''))
            .filter(Boolean)
            .join('/')
          routes.add(`${RequestMethod[method]} /${joined}`)
        }
      }
    }
  }
  return routes
}

/** 读取表格与正文中的行内接口；支持 GET/POST 合写，重复引用仅计一次。 */
function documentedRoutes(markdown: string): Set<string> {
  const routes = new Set<string>()
  for (const [, code] of markdown.matchAll(/`([^`\n]+)`/g)) {
    const match = code!.match(/^([A-Z]+(?:\/[A-Z]+)*)\s+(\/\S+)$/)
    if (!match) continue
    const [, methods, path] = match as [string, string, string]
    if (/[<>[\]?#]/.test(path)) throw new Error(`接口路径必须具体列出，查询参数另行说明：${code}`)
    for (const method of methods.split('/')) {
      if (typeof RequestMethod[method as keyof typeof RequestMethod] !== 'number') {
        throw new Error(`文档包含未知的 HTTP 方法：${method}`)
      }
      routes.add(`${method} ${path}`)
    }
  }
  return routes
}

function routeDifferences(actual: Set<string>, documented: Set<string>) {
  return {
    文档缺失: [...actual].filter((route) => !documented.has(route)).sort(),
    文档多余: [...documented].filter((route) => !actual.has(route)).sort(),
  }
}

describe('API 文档与控制器路由一致性', () => {
  it('docs/api.md 完整覆盖所有控制器路由，且不保留已删除的路由', () => {
    const files = controllerFiles(join(__dirname, 'modules'))
    expect(files.length).toBeGreaterThan(0)
    const actual = new Set<string>()
    for (const file of files) {
      // 通过 Jest 加载 TypeScript，使真实装饰器执行；不创建 Nest 应用或调用处理器。
      const exports = jest.requireActual<Record<string, unknown>>(file)
      for (const route of controllerRoutes(exports)) actual.add(route)
    }
    const markdown = readFileSync(resolve(__dirname, '../../../../docs/api.md'), 'utf8')
    const documented = documentedRoutes(markdown)
    expect(actual.size).toBeGreaterThan(0)
    expect(documented.size).toBeGreaterThan(0)
    expect(routeDifferences(actual, documented)).toEqual({ 文档缺失: [], 文档多余: [] })
  })

  it('读取同文件的全部控制器、继承方法、根路径、路径数组与别名装饰器，忽略普通导出和辅助方法', () => {
    class BaseController {
      @Get('inherited')
      inherited() {}
    }
    @Controller(['first', '/second/'])
    class MultiplePathsController extends BaseController {
      @Get()
      list() {}

      @HttpPost([':id', '/by-slug/:slug/'])
      create() {}

      helper() {}
    }
    @Controller()
    class RootController {
      @Get()
      root() {}
    }
    class Dto {}

    expect([...controllerRoutes({ MultiplePathsController, RootController, Dto, limit: 10 })].sort()).toEqual([
      'GET /',
      'GET /first',
      'GET /first/inherited',
      'GET /second',
      'GET /second/inherited',
      'POST /first/:id',
      'POST /first/by-slug/:slug',
      'POST /second/:id',
      'POST /second/by-slug/:slug',
    ])
  })

  it('解析合写方法、同格多个入口与正文引用，同时保留参数名和文件路由', () => {
    const markdown = [
      '| `GET/POST /posts`、`GET/PATCH/DELETE /admin/posts/:id` | 文章 |',
      '重复引用 `GET /posts`；媒体 `GET /media/:file`；探针 `GET /health` 与 `GET /ready`。',
      '非接口说明 `/api/v1`、`revision` 与 `Authorization: Bearer <accessToken>`。',
    ].join('\n')
    expect([...documentedRoutes(markdown)].sort()).toEqual([
      'DELETE /admin/posts/:id',
      'GET /admin/posts/:id',
      'GET /health',
      'GET /media/:file',
      'GET /posts',
      'GET /ready',
      'PATCH /admin/posts/:id',
      'POST /posts',
    ])
  })

  it('接口新增、删除以及方法或参数名变化都会产生双向差异', () => {
    const actual = new Set(['GET /new', 'POST /changed', 'GET /items/:id'])
    const documented = documentedRoutes('`GET /deleted`、`GET /changed`、`GET /items/:slug`')
    expect(routeDifferences(actual, documented)).toEqual({
      文档缺失: ['GET /items/:id', 'GET /new', 'POST /changed'],
      文档多余: ['GET /changed', 'GET /deleted', 'GET /items/:slug'],
    })
  })

  it.each(['GET /<domain>', 'GET /media/:uuid.webp[?w=320]', 'GET /posts?page=1', 'GETT /posts'])(
    '拒绝会掩盖真实路由的文档写法：%s',
    (entry) => {
      expect(() => documentedRoutes(`\`${entry}\``)).toThrow()
    },
  )
})
