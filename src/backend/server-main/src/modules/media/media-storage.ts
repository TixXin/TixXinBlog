/**
 * @file media-storage.ts
 * @description 媒体存储边界及本地磁盘实现，资源键不能控制文件系统路径。
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdir, open, readFile, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export abstract class MediaStorage {
  abstract put(key: string, content: Buffer): Promise<void>
  abstract get(key: string): Promise<Buffer>
  abstract readIfExists(key: string): Promise<Buffer | null>
  abstract remove(key: string): Promise<void>
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
  constructor(config: ConfigService) {
    super()
    const configured = config.get<string>('MEDIA_DIRECTORY')
    if (config.get('NODE_ENV') === 'test' && !configured) throw new Error('测试媒体必须使用独立目录')
    this.root = resolve(configured || './var/media')
  }
  private path(key: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(key))
      throw new Error('非法媒体资源键')
    const path = resolve(this.root, key)
    if (dirname(path) !== this.root) throw new Error('媒体路径越界')
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
  }
}
