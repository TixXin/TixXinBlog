/**
 * @file serve.mjs
 * @description 静态发布产物的本机服务器：按静态托管的规则返回文件，未知地址返回 404.html；
 *   录制模式下冻结接口文件或受管媒体缺失时回源真实接口并写入产物，供构建脚本的浏览器爬取使用。
 *   用法：node scripts/static/serve.mjs --root <产物目录> [--port 4310] [--record <接口基址> --locale zh-CN]
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frozenApiFile, frozenApiKey } from '../../src/frontend/web-blog/app/features/static/frozenApi.ts'
import { listPagePath } from './routes.mjs'

const FROZEN_SOURCE_HEADER = 'x-static-source'
const MEDIA = /^\/api\/v1\/media\/([0-9a-f-]{36})(?:-w(\d+))?\.webp$/i
const FAVICON = /^\/api\/v1\/subscriptions\/favicons\/[a-f0-9]{64}\.webp$/
const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

/** 地址对应的产物文件：与静态托管一致，目录取 index.html，无扩展名再试 .html */
export function resolveFile(root, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const target = normalize(join(root, decoded))
  if (target !== root && !target.startsWith(root + sep)) return null
  for (const candidate of [target, join(target, 'index.html'), `${target}.html`])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return null
}

/** 录制：冻结接口按原始键回源，媒体按原图或宽度变体回源；写入前检查哈希文件名没有被另一个键占用 */
export function createRecorder(root, api, locale) {
  const manifestFile = join(root, '_api', 'manifest.json')
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {}
  const base = api.replace(/\/$/, '')
  const origin = new URL(base).origin
  function save(file, body) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
  async function frozen(pathname, key) {
    const name = pathname.slice('/_api/'.length)
    if (manifest[name] && manifest[name] !== key) throw new Error(`冻结接口文件名冲突：${manifest[name]} 与 ${key}`)
    const allKey = key.endsWith('#all') ? key.slice(0, -4) : null
    const body = allKey ? await readAll(allKey) : await readJson(key)
    if (!body) return false
    manifest[name] = key
    save(join(root, pathname), JSON.stringify(body))
    save(manifestFile, JSON.stringify(manifest, null, 2))
    // 游标分页：顺着 nextCursor 把后续页一并录下，浏览器“加载更多”时请求的正是这些键。
    const cursor = body.data?.nextCursor
    if (!allKey && typeof cursor === 'string' && cursor) {
      const [path, search = ''] = key.split('?', 2)
      const next = frozenApiKey(path, { ...Object.fromEntries(new URLSearchParams(search)), before: cursor })
      if (!existsSync(join(root, frozenApiFile(next)))) await frozen(frozenApiFile(next), next)
    }
    return true
  }
  async function readJson(key) {
    const response = await fetch(base + key, { headers: { 'accept-language': locale, accept: 'application/json' } })
    if (!response.ok) return null
    const body = await response.json()
    return body.code === 0 ? body : null
  }
  /** 列表全量：逐页取尽后合成一页，供浏览器内的文本查询与筛选使用；每页 12 条，各列表接口都接受 */
  async function readAll(path) {
    const items = []
    let first, cursor
    for (let page = 1; page <= 1000; page += 1) {
      const body = await readJson(listPagePath(path, 12, page, cursor))
      if (!body || !Array.isArray(body.data?.items)) return null
      first ??= body
      items.push(...body.data.items)
      cursor = body.data.nextCursor
      if (body.data.items.length < 12 || items.length >= body.data.total || cursor === null) break
    }
    const data = { ...first.data, items, total: items.length, page: 1, pageSize: items.length }
    delete data.nextCursor
    return { ...first, data }
  }
  async function media(pathname) {
    const match = pathname.match(MEDIA)
    const source = match
      ? `${origin}/api/v1/media/${match[1]}.webp${match[2] ? `?w=${match[2]}` : ''}`
      : `${origin}${pathname}`
    const response = await fetch(source)
    if (!response.ok) return false
    save(join(root, decodeURIComponent(pathname)), Buffer.from(await response.arrayBuffer()))
    return true
  }
  return { frozen, media }
}

export function startServer({ root, port = 4310, record, locale = 'zh-CN', onMiss }) {
  const recorder = record ? createRecorder(root, record, locale) : null
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    let file = resolveFile(root, url.pathname)
    try {
      if (!file && recorder) {
        const key = request.headers[FROZEN_SOURCE_HEADER]
        const recorded =
          url.pathname.startsWith('/_api/') && typeof key === 'string'
            ? await recorder.frozen(url.pathname, key)
            : MEDIA.test(url.pathname) || FAVICON.test(url.pathname)
              ? await recorder.media(url.pathname)
              : false
        if (recorded) file = resolveFile(root, url.pathname)
      }
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(String(error))
      onMiss?.({ path: url.pathname, source: request.headers[FROZEN_SOURCE_HEADER], error: String(error) })
      return
    }
    if (!file) {
      onMiss?.({ path: url.pathname, source: request.headers[FROZEN_SOURCE_HEADER] })
      const notFound = join(root, '404.html')
      response.writeHead(404, { 'content-type': types['.html'] })
      response.end(existsSync(notFound) ? readFileSync(notFound) : 'Not Found')
      return
    }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file))
  })
  // port 为 0 时由系统分配，实际端口见 server.address().port
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (name) => {
    const index = args.indexOf(name)
    return index === -1 ? undefined : args[index + 1]
  }
  const root = option('--root')
  if (!root) throw new Error('用法：serve.mjs --root <产物目录> [--port 4310] [--record <接口基址> --locale zh-CN]')
  const port = Number(option('--port') ?? 4310)
  await startServer({
    root: normalize(root).replace(/[\\/]$/, ''),
    port,
    record: option('--record'),
    locale: option('--locale'),
    onMiss: (miss) => process.stderr.write(`404 ${miss.path}${miss.source ? ` ← ${miss.source}` : ''}\n`),
  })
  process.stdout.write(`静态产物：http://127.0.0.1:${port}\n`)
}
