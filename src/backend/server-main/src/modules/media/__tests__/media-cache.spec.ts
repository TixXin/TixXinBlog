/** @file media-cache.spec.ts @description 条件媒体读取先验证登记与磁盘状态，304 和 HEAD 不读取完整字节。 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaService } from '../media.service'
import { LocalMediaStorage } from '../media-storage'

it('强弱 ETag、HEAD、删除和文件缺失均遵循重新验证契约', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tixxin-media-cache-'))
  const storage = new LocalMediaStorage(new ConfigService({ NODE_ENV: 'test', MEDIA_DIRECTORY: directory }))
  const id = randomUUID()
  const bytes = Buffer.from('isolated-media-bytes')
  const asset = {
    storageKey: `${id}.webp`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.length,
  }
  const findOne = jest.fn().mockResolvedValue(asset)
  const service = new MediaService({ findOne } as unknown as EntityManager, storage)
  const read = jest.spyOn(storage, 'get')
  try {
    await storage.put(asset.storageKey, bytes)
    const initial = await service.read(id)
    expect(initial.content).toEqual(bytes)
    read.mockClear()
    for (const ifNoneMatch of [initial.etag, `W/${initial.etag}`, `"other", ${initial.etag}`, '*']) {
      expect(await service.read(id, { ifNoneMatch })).toMatchObject({ notModified: true, content: undefined })
    }
    expect(await service.read(id, { head: true })).toMatchObject({ notModified: false, content: undefined })
    expect(read).not.toHaveBeenCalled()
    findOne.mockResolvedValueOnce(null)
    await expect(service.read(id, { ifNoneMatch: initial.etag })).rejects.toThrow('媒体不存在或已移除')
    await storage.remove(asset.storageKey)
    await expect(service.read(id, { ifNoneMatch: initial.etag })).rejects.toThrow('媒体文件暂不可用')
    expect(read).not.toHaveBeenCalled()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
