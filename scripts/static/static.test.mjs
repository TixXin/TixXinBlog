/** @file static.test.mjs @description 静态发布构建脚本：地址清单、分页与游标、媒体扫描、产物裁剪、平台配置与本机服务器 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { mediaReferences, pruneOutput, writeHostingFiles } from './finalize.mjs'
import { listPagePath, readAll, staticRoutes } from './routes.mjs'
import { resolveFile, startServer } from './serve.mjs'
import { frozenApiFile } from '../../src/frontend/web-blog/app/features/static/frozenApi.ts'

const temp = () => mkdtempSync(join(tmpdir(), 'static-publish-'))
const uuid = '8b7c145a-50b1-4b98-9867-87de592527ab'

test('页码列表与游标列表分别构造分页地址', () => {
  assert.equal(listPagePath('/posts', 12, 2), '/posts?page=2&pageSize=12')
  assert.equal(listPagePath('/moments?pinnedFirst=false', 12, 1), '/moments?pinnedFirst=false&page=1&pageSize=12')
  assert.equal(listPagePath('/guestbook', 12, 1), '/guestbook?pageSize=12')
  assert.equal(listPagePath('/guestbook', 12, 2, 'a+b'), '/guestbook?pageSize=12&before=a%2Bb')
})

test('全量读取按 total 与游标结束', async () => {
  const pages = { 1: [1, 2], 2: [3] }
  const read = async (path) => {
    const page = Number(new URL(path, 'http://x').searchParams.get('page'))
    return { items: pages[page] ?? [], total: 3 }
  }
  assert.deepEqual(await readAll(read, '/posts', 2), [1, 2, 3])
  const cursors = {
    '': { items: [1, 2], total: 9, nextCursor: 'c1' },
    c1: { items: [3, 4], total: 9, nextCursor: null },
  }
  const calls = []
  const byCursor = async (path) => {
    calls.push(path)
    return cursors[new URL(path, 'http://x').searchParams.get('before') ?? '']
  }
  assert.deepEqual(await readAll(byCursor, '/guestbook', 2), [1, 2, 3, 4])
  assert.deepEqual(calls, ['/guestbook?pageSize=2', '/guestbook?pageSize=2&before=c1'])
})

test('地址清单包含固定页面、订阅源与真实内容，排除后台和无法表示的话题', async () => {
  const data = {
    '/posts/metadata': {
      archive: [
        { id: 3, slug: '' },
        { id: 4, slug: '部署' },
      ],
      tags: [
        { label: 'C#', count: 2 },
        { label: '空', count: 0 },
      ],
      categories: [{ name: '随笔', count: 1 }],
    },
    '/moments/overview': { topics: [{ name: '生活' }, { name: 'a/b' }] },
  }
  const read = async (path) => {
    if (data[path]) return data[path]
    if (path.startsWith('/flashes'))
      return { items: [{ id: 'f1' }, { id: 'f2', isDraft: true }, { id: 'f3', isArchived: true }], total: 3 }
    return { items: [{ id: 'm1' }], total: 1 }
  }
  const routes = await staticRoutes(read)
  for (const route of ['/', '/rss.xml', '/sitemap.xml', '/articles/3', `/articles/${encodeURIComponent('部署')}`])
    assert.ok(routes.includes(route), route)
  assert.ok(routes.includes('/tags/C%23') && !routes.some((route) => route.startsWith('/tags/%E7%A9%BA')))
  assert.ok(routes.includes('/flash/f1') && !routes.includes('/flash/f2') && !routes.includes('/flash/f3'))
  assert.ok(routes.includes('/moments/m1') && routes.includes(`/moments/topic/${encodeURIComponent('生活')}`))
  assert.ok(!routes.some((route) => route.includes('a/b') || route.startsWith('/admin') || route === '/setup'))
})

test('媒体扫描为每张受管图片列出原图与全部宽度变体，产物裁剪删除 SPA 回退与压缩副本', () => {
  const root = temp()
  mkdirSync(join(root, '_api'))
  writeFileSync(join(root, 'index.html'), `<img src="/api/v1/media/${uuid}-w640.webp">`)
  writeFileSync(join(root, '_api', 'a.json'), `{"cover":"/api/v1/media/${uuid.toUpperCase()}.webp"}`)
  writeFileSync(join(root, 'feed.xml'), `/api/v1/subscriptions/favicons/${'a'.repeat(64)}.webp`)
  const media = mediaReferences(root)
  assert.equal(media.length, 6)
  assert.ok(media.includes(`/api/v1/media/${uuid}-w1280.webp`))
  for (const name of ['200.html', 'index.html.br', 'index.html.gz']) writeFileSync(join(root, name), '')
  pruneOutput(root)
  assert.ok(existsSync(join(root, 'index.html')))
  assert.ok(!existsSync(join(root, '200.html')) && !existsSync(join(root, 'index.html.br')))
})

test('平台配置写入同一组安全头与重定向', () => {
  const root = temp()
  writeHostingFiles(root, { 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'" })
  assert.equal(
    readFileSync(join(root, '_headers'), 'utf8'),
    "/*\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'\n",
  )
  assert.equal(readFileSync(join(root, '_redirects'), 'utf8'), '/articles / 301\n')
  const edgeone = JSON.parse(readFileSync(join(root, 'edgeone.json'), 'utf8'))
  assert.deepEqual(edgeone.headers[0].headers[0], { key: 'X-Frame-Options', value: 'DENY' })
  assert.deepEqual(edgeone.redirects, [{ source: '/articles', destination: '/', statusCode: 301 }])
})

test('本机服务器按静态托管规则解析路径，拒绝越界', () => {
  const root = temp()
  mkdirSync(join(root, 'tags', '前端'), { recursive: true })
  writeFileSync(join(root, 'tags', '前端', 'index.html'), 'tag')
  assert.equal(resolveFile(root, `/tags/${encodeURIComponent('前端')}`), join(root, 'tags', '前端', 'index.html'))
  assert.equal(resolveFile(root, '/../etc/passwd'), null)
  assert.equal(resolveFile(root, '/%E0%A4%A'), null)
  assert.equal(resolveFile(root, '/missing'), null)
})

test('录制模式回源冻结接口与媒体，顺游标补全后续页，校验模式缺失返回 404', async (t) => {
  const upstream = createServer((request, response) => {
    const url = new URL(request.url, 'http://x')
    if (url.pathname.startsWith('/api/v1/media/')) return response.end(`image ${url.search}`)
    const body = url.searchParams.get('before')
      ? { items: [{ id: 2 }], total: 2, nextCursor: null }
      : { items: [{ id: 1 }], total: 2, nextCursor: 'next' }
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ code: 0, data: body }))
  })
  await new Promise((done) => upstream.listen(0, '127.0.0.1', done))
  t.after(() => upstream.close())
  const root = temp()
  writeFileSync(join(root, '404.html'), 'not found')
  const api = `http://127.0.0.1:${upstream.address().port}/api/v1`
  const recorder = await startServer({ root, port: 0, record: api, locale: 'zh-CN' })
  t.after(() => recorder.close())
  const base = `http://127.0.0.1:${recorder.address().port}`
  const key = '/guestbook?pageSize=12'
  const first = await fetch(base + frozenApiFile(key), { headers: { 'x-static-source': key } })
  assert.equal(first.status, 200)
  assert.ok(existsSync(join(root, frozenApiFile('/guestbook?before=next&pageSize=12'))))
  assert.equal((await fetch(`${base}/api/v1/media/${uuid}-w640.webp`)).status, 200)
  assert.equal(readFileSync(join(root, `api/v1/media/${uuid}-w640.webp`), 'utf8'), 'image ?w=640')
  const plain = await startServer({ root, port: 0 })
  t.after(() => plain.close())
  const missing = await fetch(`http://127.0.0.1:${plain.address().port}/_api/none.json`)
  assert.equal(missing.status, 404)
  assert.equal(await missing.text(), 'not found')
})
