/**
 * @file media-storage.ts
 * @description 媒体存储边界及本地磁盘实现，资源键不能控制文件系统路径；尺寸变体是可再生缓存，独立存放。
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdir, open, readdir, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const MEDIA_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/
// 变体名：<媒体 UUID>-w<宽度>-<原图 SHA-256 前 16 位>.webp，原图字节变化时旧变体自然失效。
const VARIANT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-w[1-9][0-9]{2,3}-[0-9a-f]{16}\.webp$/
/** 变体缓存目录名；以点开头，与订阅图标缓存一样不进入登记媒体清单、内容包和完整备份。 */
export const MEDIA_VARIANT_DIRECTORY = '.media-variants'
export function mediaVariantName(id: string, width: number, sha256: string) {
  return `${id}-w${width}-${sha256.slice(0, 16)}.webp`
}

export abstract class MediaStorage {
  abstract put(key: string, content: Buffer): Promise<void>
  abstract get(key: string): Promise<Buffer>
  abstract assertReadable(key: string): Promise<void>
  abstract readIfExists(key: string): Promise<Buffer | null>
  abstract remove(key: string): Promise<void>
  /** 读取派生变体，不存在返回 null。 */
  abstract readVariant(name: string): Promise<Buffer | null>
  /** 原子写入派生变体；并发写入同名文件时以最后一次重命名为准，内容等价。 */
  abstract writeVariant(name: string, content: Buffer): Promise<void>
  /** 删除某个原图键的全部派生变体，返回删除数量。 */
  abstract removeVariants(key: string): Promise<number>
  async probe(): Promise<{ readable: boolean; writable: boolean; cleaned: boolean }> {
    const key = `${randomUUID()}.webp`
    const sample = Buffer.from('tixxin-storage-probe')
    let created = false
    const result = { readable: false, writable: false, cleaned: true }
    try {
      await this.put(key, sample)
      created = true
      result.writable = true
      result.readable = (await this.get(key)).equals(sample)
    } catch {
      /* 管理诊断只返回状态，不公开磁盘路径或异常详情。 */
    } finally {
      if (created) {
        try {
          await this.remove(key)
        } catch {
          result.cleaned = false
        }
      }
    }
    return result
  }
}

@Injectable()
export class LocalMediaStorage extends MediaStorage {
  private readonly root: string
  private readonly variants: string
  constructor(config: ConfigService) {
    super()
    const configured = config.get<string>('MEDIA_DIRECTORY')
    if (config.get('NODE_ENV') === 'test' && !configured) throw new Error('测试媒体必须使用独立目录')
    this.root = resolve(configured || './var/media')
    this.variants = resolve(this.root, MEDIA_VARIANT_DIRECTORY)
  }
  private path(key: string) {
    if (!MEDIA_KEY.test(key)) throw new Error('非法媒体资源键')
    const path = resolve(this.root, key)
    if (dirname(path) !== this.root) throw new Error('媒体路径越界')
    return path
  }
  private variantPath(name: string) {
    if (!VARIANT_NAME.test(name)) throw new Error('非法媒体变体名')
    const path = resolve(this.variants, name)
    if (dirname(path) !== this.variants) throw new Error('媒体变体路径越界')
    return path
  }
  async put(key: string, content: Buffer) {
    const path = this.path(key)
    await mkdir(this.root, { recursive: true })
    const file = await open(path, 'wx', 0o600)
    try {
      await file.writeFile(content)
    } catch (error) {
      await file.close()
      await unlink(path).catch(() => undefined)
      throw error
    }
    await file.close()
  }
  get(key: string) {
    return readFile(this.path(key))
  }
  async assertReadable(key: string) {
    // 条件请求只打开并检查文件，不为 304/HEAD 分配完整图片缓冲区。
    const file = await open(this.path(key), 'r')
    try {
      if (!(await file.stat()).isFile()) throw new Error('媒体资源不是普通文件')
    } finally {
      await file.close()
    }
  }
  async readIfExists(key: string): Promise<Buffer | null> {
    try {
      return await this.get(key)
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null
      throw error
    }
  }
  async remove(key: string) {
    await unlink(this.path(key))
    // 原图移除后变体只是失效缓存，清理失败不影响主流程。
    await this.removeVariants(key).catch(() => undefined)
  }
  async readVariant(name: string): Promise<Buffer | null> {
    try {
      return await readFile(this.variantPath(name))
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null
      throw error
    }
  }
  async writeVariant(name: string, content: Buffer) {
    const path = this.variantPath(name)
    await mkdir(this.variants, { recursive: true, mode: 0o700 })
    // 先写临时文件再重命名，读取方不会看到写了一半的变体。
    const temporary = `${path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(content)
      await file.close()
      await rename(temporary, path)
    } catch (error) {
      await file.close().catch(() => undefined)
      await unlink(temporary).catch(() => undefined)
      throw error
    }
  }
  async removeVariants(key: string) {
    const prefix = `${this.path(key).slice(this.root.length + 1, -5)}-`
    let names: string[]
    try {
      names = await readdir(this.variants)
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return 0
      throw error
    }
    let removed = 0
    for (const name of names) {
      if (!name.startsWith(prefix)) continue
      const path = resolve(this.variants, name)
      if (dirname(path) !== this.variants) continue
      try {
        await unlink(path)
        removed++
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') throw error
      }
    }
    return removed
  }
}
