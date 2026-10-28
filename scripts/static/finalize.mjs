/**
 * @file finalize.mjs
 * @description 静态发布产物收尾：列出页面与冻结接口引用的受管媒体及订阅图标、删除 SPA 回退与预压缩副本、
 *   写入 Cloudflare（_headers、_redirects）与 EdgeOne（edgeone.json）的安全头与重定向，并统计产物规模。
 */
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/** 与 app/utils/managedImage.ts 的 MANAGED_IMAGE_WIDTHS 一致 */
export const MEDIA_WIDTHS = [320, 640, 960, 1280]
const MEDIA = /\/api\/v1\/media\/([0-9a-f-]{36})(?:-w\d+)?\.webp/gi
const FAVICON = /\/api\/v1\/subscriptions\/favicons\/[a-f0-9]{64}\.webp/g
/** 服务器部署 routeRules 中的固定重定向 */
export const STATIC_REDIRECTS = [{ source: '/articles', destination: '/', statusCode: 301 }]

export function* walk(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

/** 产物中引用到的媒体文件地址：每张受管图片的原图与全部宽度变体，以及订阅图标 */
export function mediaReferences(root) {
  const ids = new Set()
  const favicons = new Set()
  for (const file of walk(root)) {
    if (!/\.(html|json|xml)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(MEDIA)) ids.add(match[1].toLowerCase())
    for (const match of text.matchAll(FAVICON)) favicons.add(match[0])
  }
  const paths = []
  for (const id of ids) {
    paths.push(`/api/v1/media/${id}.webp`)
    for (const width of MEDIA_WIDTHS) paths.push(`/api/v1/media/${id}-w${width}.webp`)
  }
  return [...paths, ...favicons]
}

/** 静态托管不需要 SPA 回退：未知地址应返回 404.html；平台自行压缩，删除预压缩副本以减少文件数 */
export function pruneOutput(root) {
  for (const file of [...walk(root)]) if (/\.(br|gz)$/.test(file) || relative(root, file) === '200.html') rmSync(file)
}

export function writeHostingFiles(root, headers) {
  const lines = ['/*', ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`), '']
  writeFileSync(join(root, '_headers'), lines.join('\n'))
  writeFileSync(
    join(root, '_redirects'),
    STATIC_REDIRECTS.map((rule) => `${rule.source} ${rule.destination} ${rule.statusCode}`).join('\n') + '\n',
  )
  const edgeone = {
    redirects: STATIC_REDIRECTS,
    headers: [{ source: '/*', headers: Object.entries(headers).map(([key, value]) => ({ key, value })) }],
  }
  writeFileSync(join(root, 'edgeone.json'), JSON.stringify(edgeone, null, 2) + '\n')
}

export function outputReport(root) {
  let files = 0,
    bytes = 0,
    largest = { path: '', bytes: 0 }
  const groups = {}
  for (const file of walk(root)) {
    const size = statSync(file).size
    const path = relative(root, file)
    const group = path.startsWith('_nuxt/')
      ? '_nuxt'
      : path.startsWith('_api/')
        ? '_api'
        : path.startsWith('api/v1/')
          ? '媒体'
          : '页面与其他'
    groups[group] = { files: (groups[group]?.files ?? 0) + 1, bytes: (groups[group]?.bytes ?? 0) + size }
    files += 1
    bytes += size
    if (size > largest.bytes) largest = { path, bytes: size }
  }
  return { files, bytes, largest, groups }
}
