/**
 * @file media.mjs
 * @description 内容仓库的受管媒体：内容包里的 base64 原图与 media/<UUID>.<扩展名> 文件互转。
 *              元数据写在 media/index.yaml；转回内容包时逐个核对字节数与 SHA-256，不一致直接拒绝。
 * @author TixXin
 * @since 2026-11-05
 */
import { createHash } from 'node:crypto'

const SIGNATURES = [
  {
    ext: 'webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { ext: 'avif', test: (b) => b.subarray(4, 12).toString('latin1') === 'ftypavif' },
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function mediaExtension(bytes) {
  return SIGNATURES.find((signature) => signature.test(bytes))?.ext ?? 'bin'
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 内容包媒体 → index.yaml 条目与图片文件 */
export function splitMedia(media) {
  const index = []
  const files = new Map()
  for (const item of media) {
    if (!UUID_RE.test(item.id)) throw new Error(`媒体编号不是 UUID：${item.id}`)
    const { base64, ...meta } = item
    index.push(meta)
    if (base64 === undefined) continue
    const bytes = Buffer.from(base64, 'base64')
    files.set(`media/${item.id}.${mediaExtension(bytes)}`, bytes)
  }
  return { index, files }
}

/** index.yaml 条目与图片文件 → 内容包媒体；mediaIncluded 为 true 时每个条目都必须有文件 */
export function joinMedia(index, files, mediaIncluded) {
  if (!Array.isArray(index)) throw new Error('media/index.yaml 必须是列表')
  const byId = new Map()
  for (const [path, bytes] of files) {
    const match = /^media\/([0-9a-f-]{36})\.[a-z0-9]+$/.exec(path)
    if (!match) throw new Error(`media/ 下的文件名必须是 <媒体UUID>.<扩展名>：${path}`)
    if (byId.has(match[1])) throw new Error(`同一媒体有多个文件：${match[1]}`)
    byId.set(match[1], { path, bytes })
  }
  const listed = new Set()
  const media = index.map((meta) => {
    if (!meta || typeof meta !== 'object' || !UUID_RE.test(meta.id))
      throw new Error('media/index.yaml 条目缺少有效的 id')
    if (listed.has(meta.id)) throw new Error(`media/index.yaml 重复登记：${meta.id}`)
    listed.add(meta.id)
    const file = byId.get(meta.id)
    if (!file) {
      if (mediaIncluded) throw new Error(`缺少媒体文件：media/${meta.id}.*`)
      return { ...meta }
    }
    if (!mediaIncluded) throw new Error(`mediaIncluded 为 false 时不能附带媒体文件：${file.path}`)
    if (file.bytes.length !== meta.byteSize)
      throw new Error(`${file.path} 字节数 ${file.bytes.length} 与登记的 ${meta.byteSize} 不一致`)
    const digest = sha256(file.bytes)
    if (digest !== meta.sha256) throw new Error(`${file.path} 的 SHA-256 与登记不一致`)
    return { ...meta, base64: file.bytes.toString('base64') }
  })
  for (const [id, file] of byId)
    if (!listed.has(id)) throw new Error(`媒体文件未在 media/index.yaml 登记：${file.path}`)
  return media
}
