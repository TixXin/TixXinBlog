/**
 * @file layout.mjs
 * @description 内容包与内容仓库目录的双向转换（纯函数，输入输出都是 路径 → 内容 的 Map）。
 *              文章、闪念、朋友圈写成 Markdown + frontmatter，其余内容域写成 YAML，媒体见 media.mjs。
 *              转换只搬运字段，不做业务校验；生成的内容包仍由后台导入预览按内容包规则完整校验。
 * @author TixXin
 * @since 2026-11-05
 */
import { fromYaml, readMarkdown, toYaml, writeMarkdown } from './markdown.mjs'
import { joinMedia, splitMedia } from './media.mjs'

export const MANIFEST = 'tixxin-content.yaml'

/** 写成 Markdown 的内容域：body 为正文字段，meta 为 values 之外的记录字段（按内容包顺序） */
const DOCUMENTS = {
  posts: { body: 'contentRaw', meta: ['sourceId', 'createdAt', 'publishedAt', 'deleted'] },
  flashes: { body: 'content', meta: ['sourceId', 'createdAt'] },
  moments: { body: 'content', meta: ['sourceId', 'createdAt', 'publishedAt', 'deleted'] },
}

/** 整体写成一个 YAML 文件的字段 */
const YAML_FILES = {
  site: 'site.yaml',
  guestbook: 'guestbook.yaml',
  gallery: 'gallery.yaml',
  projects: 'projects.yaml',
  links: 'links.yaml',
  prompts: 'prompts.yaml',
  subscriptions: 'subscriptions.yaml',
}

const MANIFEST_KEYS = [
  'format',
  'version',
  'exportedAt',
  'omittedRelations',
  'mediaIncluded',
  'requireCommentApproval',
  'folders',
  'tags',
  'linkSettings',
  'gallerySettings',
]

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function baseName(kind, record) {
  if (kind === 'posts') {
    const slug = record.values?.slug
    return typeof slug === 'string' && SLUG_RE.test(slug) ? slug : `post-${record.sourceId}`
  }
  const day = typeof record.createdAt === 'string' ? record.createdAt.slice(0, 10) : 'undated'
  return `${day}-${String(record.sourceId).slice(0, 8)}`
}

function documentToFile(kind, record) {
  const { body, meta } = DOCUMENTS[kind]
  const { values = {}, comments = [], ...rest } = record
  const frontmatter = {}
  for (const key of meta) if (key in rest) frontmatter[key] = rest[key]
  for (const key of Object.keys(rest))
    if (!meta.includes(key)) throw new Error(`${kind} 记录 ${record.sourceId} 有未知字段 ${key}，请先升级本工具`)
  for (const [key, value] of Object.entries(values)) {
    if (key === body) continue
    if (key in frontmatter || key === 'comments')
      throw new Error(`${kind} 记录 ${record.sourceId} 的字段 ${key} 与记录字段重名`)
    frontmatter[key] = value
  }
  if (comments.length) frontmatter.comments = comments
  const text = values[body]
  if (text !== undefined && typeof text !== 'string')
    throw new Error(`${kind} 记录 ${record.sourceId} 的 ${body} 不是字符串`)
  return writeMarkdown(frontmatter, text ?? '')
}

function fileToDocument(kind, text, path) {
  const { body, meta } = DOCUMENTS[kind]
  const { frontmatter, body: content } = readMarkdown(text, path)
  const record = {}
  const values = {}
  for (const key of meta) if (key in frontmatter) record[key] = frontmatter[key]
  for (const [key, value] of Object.entries(frontmatter)) {
    if (meta.includes(key) || key === 'comments') continue
    values[key] = value
  }
  if (!('sourceId' in record)) throw new Error(`${path}：frontmatter 缺少 sourceId`)
  values[body] = content
  record.values = values
  record.comments = frontmatter.comments ?? []
  return record
}

function compareRecords(a, b) {
  if (typeof a.sourceId === 'number' && typeof b.sourceId === 'number') return a.sourceId - b.sourceId
  return String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.sourceId).localeCompare(String(b.sourceId))
}

/** 内容包 → 仓库文件 */
export function packToFiles(pack) {
  if (pack?.format !== 'tixxin-content') throw new Error('不是 tixxin-content 内容包')
  const files = new Map()
  const known = new Set([...MANIFEST_KEYS, ...Object.keys(DOCUMENTS), ...Object.keys(YAML_FILES), 'media'])
  for (const key of Object.keys(pack)) if (!known.has(key)) throw new Error(`内容包有未知字段 ${key}，请先升级本工具`)
  const manifest = {}
  for (const key of MANIFEST_KEYS) if (key in pack) manifest[key] = pack[key]
  files.set(MANIFEST, toYaml(manifest))
  for (const [key, file] of Object.entries(YAML_FILES)) if (key in pack) files.set(file, toYaml(pack[key]))
  for (const kind of Object.keys(DOCUMENTS)) {
    const used = new Set()
    for (const record of [...(pack[kind] ?? [])].sort(compareRecords)) {
      let name = baseName(kind, record)
      if (used.has(name)) name = `${name}-${String(record.sourceId)}`
      if (used.has(name)) throw new Error(`${kind} 记录 ${record.sourceId} 的文件名重复`)
      used.add(name)
      files.set(`${kind}/${name}.md`, documentToFile(kind, record))
    }
  }
  const { index, files: mediaFiles } = splitMedia(pack.media ?? [])
  files.set('media/index.yaml', toYaml(index))
  for (const [path, bytes] of mediaFiles) files.set(path, bytes)
  return files
}

/** 仓库文件 → 内容包；files 的值可以是字符串或 Buffer */
export function filesToPack(files) {
  const text = (path) => {
    const value = files.get(path)
    return Buffer.isBuffer(value) ? value.toString('utf8') : value
  }
  if (!files.has(MANIFEST)) throw new Error(`缺少 ${MANIFEST}，不是内容仓库`)
  const manifest = fromYaml(text(MANIFEST), MANIFEST) ?? {}
  if (manifest.format !== 'tixxin-content') throw new Error(`${MANIFEST} 的 format 必须是 tixxin-content`)
  const pack = {}
  for (const key of MANIFEST_KEYS) if (key in manifest) pack[key] = manifest[key]
  const groups = { posts: [], flashes: [], moments: [] }
  const mediaFiles = new Map()
  for (const path of [...files.keys()].sort()) {
    const [dir] = path.split('/')
    if (path === MANIFEST || path === 'media/index.yaml' || Object.values(YAML_FILES).includes(path)) continue
    if (dir in groups && path.endsWith('.md') && path.split('/').length === 2)
      groups[dir].push(fileToDocument(dir, text(path), path))
    else if (dir === 'media')
      mediaFiles.set(path, Buffer.isBuffer(files.get(path)) ? files.get(path) : Buffer.from(files.get(path)))
    else throw new Error(`无法识别的仓库文件：${path}`)
  }
  for (const kind of Object.keys(groups)) pack[kind] = groups[kind].sort(compareRecords)
  for (const [key, file] of Object.entries(YAML_FILES)) if (files.has(file)) pack[key] = fromYaml(text(file), file)
  const index = files.has('media/index.yaml') ? (fromYaml(text('media/index.yaml'), 'media/index.yaml') ?? []) : []
  pack.media = joinMedia(index, mediaFiles, pack.mediaIncluded === true)
  return pack
}
