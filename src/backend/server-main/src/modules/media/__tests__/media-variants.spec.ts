/**
 * @file media-variants.spec.ts
 * @description 受管媒体宽度变体：白名单校验、按需生成与磁盘缓存、并发去重、ETag/HEAD 与变体清理。
 */
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { Request, Response } from 'express'
import { MediaService } from '../media.service'
import { LocalMediaStorage, MEDIA_VARIANT_DIRECTORY, mediaVariantName } from '../media-storage'
import { PublicMediaController } from '../media.controller'
import { isMediaVariantWidth, MEDIA_VARIANT_WIDTHS } from '../media-image'

describe('受管媒体宽度变体', () => {
  let directory: string
  let storage: LocalMediaStorage
  let service: MediaService
  let findOne: jest.Mock
  const id = randomUUID()
  let original: Buffer
  let asset: { id: string; storageKey: string; sha256: string; byteSize: number; width: number; height: number }

  beforeAll(async () => {
    original = await sharp({ create: { width: 1000, height: 600, channels: 3, background: '#3a6ea5' } })
      .webp({ quality: 90 })
      .toBuffer()
  })
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'tixxin-media-variant-'))
    storage = new LocalMediaStorage(new ConfigService({ NODE_ENV: 'test', MEDIA_DIRECTORY: directory }))
    asset = {
      id,
      storageKey: `${id}.webp`,
      sha256: createHash('sha256').update(original).digest('hex'),
      byteSize: original.length,
      width: 1000,
      height: 600,
    }
    await storage.put(asset.storageKey, original)
    findOne = jest.fn().mockResolvedValue(asset)
    service = new MediaService({ findOne } as unknown as EntityManager, storage)
  })
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('白名单只包含约定宽度', () => {
    expect([...MEDIA_VARIANT_WIDTHS]).toEqual([320, 640, 960, 1280])
    expect(isMediaVariantWidth(640)).toBe(true)
    expect(isMediaVariantWidth(500)).toBe(false)
  })

  it('首次请求生成缩小的 WebP 并写入独立缓存目录，再次请求直接读缓存', async () => {
    const write = jest.spyOn(storage, 'writeVariant')
    const first = await service.read(id, { width: 320 })
    const metadata = await sharp(first.content).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: 320, height: 192 })
    expect(first.etag).toBe(`"${asset.sha256}-w320"`)
    expect(first.byteSize).toBe(first.content?.length)
    expect(first.byteSize).toBeLessThan(original.length)
    expect(await readdir(join(directory, MEDIA_VARIANT_DIRECTORY))).toEqual([mediaVariantName(id, 320, asset.sha256)])
    // 原图目录只保留登记文件，变体不混入。
    expect((await readdir(directory)).sort()).toEqual([MEDIA_VARIANT_DIRECTORY, asset.storageKey].sort())
    const read = jest.spyOn(storage, 'get')
    const second = await service.read(id, { width: 320 })
    expect(second.content).toEqual(first.content)
    expect(read).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('请求宽度不小于原图时返回原图字节与原图 ETag，不生成缓存', async () => {
    const result = await service.read(id, { width: 1280 })
    expect(result.content).toEqual(original)
    expect(result.etag).toBe(`"${asset.sha256}"`)
    await expect(readdir(join(directory, MEDIA_VARIANT_DIRECTORY))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('同一变体的并发请求只生成一次', async () => {
    const write = jest.spyOn(storage, 'writeVariant')
    const results = await Promise.all(Array.from({ length: 6 }, () => service.read(id, { width: 640 })))
    expect(write).toHaveBeenCalledTimes(1)
    for (const result of results) expect(result.content).toEqual(results[0]?.content)
  })

  it('变体条件请求返回 304 且不生成，HEAD 只返回长度', async () => {
    const write = jest.spyOn(storage, 'writeVariant')
    const etag = `"${asset.sha256}-w640"`
    expect(await service.read(id, { width: 640, ifNoneMatch: `W/${etag}` })).toMatchObject({
      notModified: true,
      content: undefined,
    })
    // 原图 ETag 不能命中变体。
    expect((await service.read(id, { width: 640, ifNoneMatch: `"${asset.sha256}"`, head: true })).notModified).toBe(
      false,
    )
    const head = await service.read(id, { width: 640, head: true })
    expect(head.content).toBeUndefined()
    expect(head.byteSize).toBeGreaterThan(0)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('原图字节变化后旧变体不再命中', async () => {
    await service.read(id, { width: 320 })
    asset.sha256 = 'f'.repeat(64)
    await service.read(id, { width: 320 })
    expect((await readdir(join(directory, MEDIA_VARIANT_DIRECTORY))).length).toBe(2)
  })

  it('已删除媒体不返回变体，文件缺失返回 503', async () => {
    findOne.mockResolvedValueOnce(null)
    await expect(service.read(id, { width: 320 })).rejects.toThrow('媒体不存在或已移除')
    await storage.remove(asset.storageKey)
    await expect(service.read(id, { width: 320 })).rejects.toThrow('媒体文件暂不可用')
  })

  it('移除原图或单独清理时只删除该媒体的变体', async () => {
    await service.read(id, { width: 320 })
    await service.read(id, { width: 640 })
    const otherId = randomUUID()
    const other = mediaVariantName(otherId, 320, asset.sha256)
    await storage.writeVariant(other, Buffer.from('other'))
    expect(await storage.removeVariants(asset.storageKey)).toBe(2)
    expect(await readdir(join(directory, MEDIA_VARIANT_DIRECTORY))).toEqual([other])
    await service.read(id, { width: 320 })
    await storage.remove(asset.storageKey)
    expect(await readdir(join(directory, MEDIA_VARIANT_DIRECTORY))).toEqual([other])
  })

  it('变体名不能越界或伪造', async () => {
    await writeFile(join(directory, 'outside.webp'), 'x')
    for (const name of ['../outside.webp', `${id}.webp`, `${id}-w320-zz.webp`, `${id}-w320-${'a'.repeat(16)}.webp/..`])
      await expect(storage.readVariant(name)).rejects.toThrow('非法媒体变体名')
    await expect(storage.removeVariants('../x.webp')).rejects.toThrow('非法媒体资源键')
  })

  it('公开接口拒绝非白名单宽度，合法宽度透传给服务', async () => {
    const read = jest.fn().mockResolvedValue({ etag: '"e"', notModified: true, byteSize: 1 })
    const controller = new PublicMediaController({ read } as unknown as MediaService)
    const request = { get: () => undefined, method: 'GET' } as unknown as Request
    const end = jest.fn()
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnValue({ end }),
    } as unknown as Response
    const file = `${id}.webp`
    for (const w of ['500', '0320', 'abc', '', '320.5', ['320', '640']])
      await expect(controller.read(file, w, request, response)).rejects.toThrow('图片宽度只支持')
    expect(read).not.toHaveBeenCalled()
    await controller.read(file, '960', request, response)
    expect(read).toHaveBeenLastCalledWith(id, expect.objectContaining({ width: 960 }))
    await controller.read(file, undefined, request, response)
    expect(read).toHaveBeenLastCalledWith(id, expect.objectContaining({ width: undefined }))
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000, immutable')
  })
})
