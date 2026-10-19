/** @file subscription-favicon.service.ts @description 管理员触发的固定供应商图标代理，公开读取只使用可再生缓存 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import { ConfigService } from '@nestjs/config'
import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { normalizeImage } from '../media/media-image'
import { faviconDomain } from './subscription-values'
const PROVIDER = 't3.gstatic.com'
const MAX_BYTES = 256 * 1024
const SUCCESS_TTL = 7 * 24 * 60 * 60 * 1000
const FAILURE_TTL = 5 * 60 * 1000
export function faviconKey(domain: string) {
  return createHash('sha256').update(domain).digest('hex')
}
export function faviconUrl(domain: string) {
  return `/api/v1/subscriptions/favicons/${faviconKey(domain)}.webp`
}
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return (
      a !== undefined &&
      b !== undefined &&
      c !== undefined &&
      a > 0 &&
      a < 224 &&
      a !== 10 &&
      a !== 127 &&
      !(a === 100 && b >= 64 && b <= 127) &&
      !(a === 169 && b === 254) &&
      !(a === 172 && b >= 16 && b <= 31) &&
      !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
      !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
      !(a === 203 && b === 0 && c === 113)
    )
  }
  // 仅接受全球单播 IPv6，拒绝映射 IPv4、链路本地、ULA、组播及文档/转换保留段。
  if (isIP(address) !== 6) return false
  const value = new URL(`https://[${address}]`).hostname.slice(1, -1)
  const [first, second] = value.split(':').map((part) => Number.parseInt(part || '0', 16))
  return (
    first !== undefined &&
    first >= 0x2000 &&
    first <= 0x3fff &&
    !(first === 0x2001 && (second! <= 0x1ff || second === 0xdb8)) &&
    first !== 0x2002 &&
    first !== 0x3fff
  )
}
export function providerPath(domain: string) {
  return `/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${domain}`)}&size=64`
}
export async function downloadFavicon(domain: string): Promise<Buffer> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const addresses = await Promise.race([
      lookup(PROVIDER, { all: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('图标解析超时')), 3000)
      }),
    ])
    if (!addresses.length || addresses.some((item) => !publicAddress(item.address)))
      throw new Error('图标供应商地址不安全')
    const chosen = addresses.find((item) => item.family === 4) ?? addresses[0]!
    return await new Promise<Buffer>((resolveResult, reject) => {
      const req = request(
        {
          hostname: PROVIDER,
          servername: PROVIDER,
          port: 443,
          path: providerPath(domain),
          method: 'GET',
          family: chosen.family,
          lookup: (_host, _options, callback) => callback(null, chosen.address, chosen.family),
          agent: false,
          headers: { Accept: 'image/png,image/webp,image/jpeg', 'User-Agent': 'TixXinBlog-Favicon/1.0' },
          signal: AbortSignal.timeout(5000),
        },
        (response) => {
          if (
            response.statusCode !== 200 ||
            !/^image\/(?:png|webp|jpeg)(?:;|$)/i.test(String(response.headers['content-type'] ?? '')) ||
            Number(response.headers['content-length'] ?? 0) > MAX_BYTES
          ) {
            response.destroy()
            reject(new Error('图标响应不合法'))
            return
          }
          const chunks: Buffer[] = []
          let size = 0
          response.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > MAX_BYTES) {
              response.destroy(new Error('图标体积过大'))
              return
            }
            chunks.push(chunk)
          })
          response.on('error', reject)
          response.on('end', () => resolveResult(Buffer.concat(chunks)))
        },
      )
      req.on('error', reject)
      req.end()
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
}
export async function normalizeFavicon(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('图标体积不合法')
  const metadata = await sharp(bytes, { limitInputPixels: 512 * 512, failOn: 'warning' }).metadata()
  if (
    !['png', 'jpeg', 'webp'].includes(metadata.format ?? '') ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 512 ||
    metadata.height > 512 ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error('图标内容不合法')
  const result = await normalizeImage({
    buffer: bytes,
    size: bytes.length,
    originalname: `favicon.${metadata.format}`,
    mimetype: `image/${metadata.format}`,
  })
  return result.buffer
}
@Injectable()
export class SubscriptionFaviconService {
  private readonly root: string
  private readonly failures = new Map<string, number>()
  private readonly pending = new Map<
    string,
    Promise<{ faviconUrl: string | null; domain: string; state: 'ready' | 'failed' }>
  >()
  constructor(config: ConfigService) {
    const media = config.get<string>('MEDIA_DIRECTORY')
    if (config.get('NODE_ENV') === 'test' && !media) throw new Error('测试图标必须使用独立媒体目录')
    this.root = resolve(media || './var/media', '.subscription-favicons')
  }
  async read(key: string) {
    if (!/^[a-f0-9]{64}\.webp$/.test(key)) throw new NotFoundException(msg('subscription.faviconCacheNotFound'))
    try {
      return await readFile(resolve(this.root, key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException(msg('subscription.faviconCacheNotFound'))
      throw error
    }
  }
  async fetch(url: string, force = false) {
    const domain = faviconDomain(url)
    const key = faviconKey(domain)
    const pending = this.pending.get(key)
    if (pending) return pending
    const operation = this.fetchDomain(domain, key, force)
    this.pending.set(key, operation)
    try {
      return await operation
    } finally {
      this.pending.delete(key)
    }
  }
  private async fetchDomain(
    domain: string,
    key: string,
    force: boolean,
  ): Promise<{ faviconUrl: string | null; domain: string; state: 'ready' | 'failed' }> {
    const path = resolve(this.root, `${key}.webp`)
    const ready = { faviconUrl: faviconUrl(domain), domain, state: 'ready' as const }
    if (!force) {
      try {
        if (Date.now() - (await stat(path)).mtimeMs < SUCCESS_TTL) return ready
      } catch {
        /* 缓存缺失允许管理员重建。 */
      }
      if ((this.failures.get(key) ?? 0) > Date.now()) return { faviconUrl: null, domain, state: 'failed' }
    }
    try {
      const image = await normalizeFavicon(await downloadFavicon(domain))
      await mkdir(this.root, { recursive: true })
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, image, { flag: 'wx', mode: 0o600 })
        await rename(temporary, path)
      } finally {
        await unlink(temporary).catch(() => undefined)
      }
      this.failures.delete(key)
      return ready
    } catch {
      for (const [entry, until] of this.failures) if (until <= Date.now()) this.failures.delete(entry)
      if (this.failures.size >= 1000) this.failures.delete(this.failures.keys().next().value!)
      this.failures.set(key, Date.now() + FAILURE_TTL)
      // 已有成功缓存继续可读；失败不能阻断订阅编辑。
      try {
        await stat(path)
        return ready
      } catch {
        return { faviconUrl: null, domain, state: 'failed' }
      }
    }
  }
}
