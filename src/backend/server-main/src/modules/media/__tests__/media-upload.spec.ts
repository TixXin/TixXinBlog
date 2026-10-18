/**
 * @file media-upload.spec.ts
 * @description 媒体上传登记、重试幂等与文件补偿清理；真实小图解码，数据库和存储使用隔离替身。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { MediaAsset } from '../../../entities/media-asset.entity'
import { normalizeImage } from '../media-image'
import type { UploadedImage } from '../media-image'
import type { MediaStorage } from '../media-storage'
import { MediaService } from '../media.service'

const id = '12345678-1234-4123-8123-123456789abc'
const key = `${id}.webp`
const createdAt = new Date('2026-10-01T00:00:00.000Z')

function createHarness() {
  const transaction = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((_entity: typeof MediaAsset, data: Partial<MediaAsset>) =>
      Object.assign(new MediaAsset(), data, { createdAt }),
    ),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  const cleanupTransaction = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  }
  const cleanupManager = {
    transactional: jest.fn(async (callback: (em: EntityManager) => Promise<unknown>) =>
      callback(cleanupTransaction as unknown as EntityManager),
    ),
  }
  const em = {
    transactional: jest.fn(async (callback: (em: EntityManager) => Promise<unknown>) =>
      callback(transaction as unknown as EntityManager),
    ),
    fork: jest.fn(() => cleanupManager),
  }
  const storage = {
    readIfExists: jest.fn<Promise<Buffer | null>, [string]>().mockResolvedValue(null),
    put: jest.fn<Promise<void>, [string, Buffer]>().mockResolvedValue(undefined),
    remove: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  }
  return {
    service: new MediaService(em as unknown as EntityManager, storage as unknown as MediaStorage),
    transaction,
    cleanupTransaction,
    cleanupManager,
    em,
    storage,
  }
}

describe('媒体上传登记与补偿', () => {
  let file: UploadedImage
  let normalized: Awaited<ReturnType<typeof normalizeImage>>
  let sha256: string

  beforeAll(async () => {
    const buffer = await sharp({ create: { width: 6, height: 4, channels: 3, background: '#123456' } })
      .png()
      .toBuffer()
    file = { buffer, originalname: '林间步道.png', mimetype: 'image/png', size: buffer.length }
    normalized = await normalizeImage(file)
    sha256 = createHash('sha256').update(normalized.buffer).digest('hex')
  })

  function existingAsset(overrides: Partial<MediaAsset> = {}) {
    return Object.assign(
      new MediaAsset(),
      {
        id,
        originalName: '原始照片.png',
        storageKey: key,
        mimeType: 'image/webp',
        byteSize: normalized.buffer.length,
        width: 6,
        height: 4,
        sha256,
        alt: '已保存的替代文本',
        description: '已保存的来源说明',
        createdAt,
      },
      overrides,
    )
  }

  it('保存规范化 WebP 并以实际字节登记尺寸、摘要和元数据', async () => {
    const { service, transaction, storage } = createHarness()

    const result = await service.upload(file, '林间的一条步道', id.toUpperCase())

    expect(storage.put).toHaveBeenCalledTimes(1)
    const [storedKey, bytes] = storage.put.mock.calls[0]!
    expect(storedKey).toBe(key)
    expect(bytes.equals(file.buffer)).toBe(false)
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp', width: 6, height: 4 })
    expect(transaction.create).toHaveBeenCalledWith(MediaAsset, {
      id,
      originalName: file.originalname,
      storageKey: key,
      mimeType: 'image/webp',
      byteSize: bytes.length,
      width: 6,
      height: 4,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      alt: '林间的一条步道',
    })
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      id,
      name: file.originalname,
      url: `/api/v1/media/${id}.webp`,
      alt: '林间的一条步道',
      description: '',
      width: 6,
      height: 4,
      byteSize: bytes.length,
      mimeType: 'image/webp',
      createdAt: createdAt.toISOString(),
      deleted: false,
    })
    expect(transaction.execute.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.findOne.mock.invocationCallOrder[0]!,
    )
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('未传上传标识时生成 UUID 并保持响应、登记和文件键一致', async () => {
    const { service, transaction, storage } = createHarness()

    const result = await service.upload(file, '')

    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(storage.put).toHaveBeenCalledWith(`${result.id}.webp`, normalized.buffer)
    expect(transaction.create).toHaveBeenCalledWith(
      MediaAsset,
      expect.objectContaining({ id: result.id, storageKey: `${result.id}.webp` }),
    )
  })

  it('同一上传标识与规范化字节重试返回原记录，不覆盖资料或重复保存', async () => {
    const { service, transaction, em, storage } = createHarness()
    transaction.findOne.mockResolvedValue(existingAsset())

    expect(await service.upload(file, '重试传入的替代文本', id.toUpperCase())).toMatchObject({
      id,
      name: '原始照片.png',
      alt: '已保存的替代文本',
      description: '已保存的来源说明',
      createdAt: createdAt.toISOString(),
    })
    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.readIfExists).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
    expect(em.fork).not.toHaveBeenCalled()
  })

  it.each([
    ['已登记的摘要不同', { sha256: '0'.repeat(64) }],
    ['原记录已回收', { deletedAt: new Date('2026-10-02T00:00:00.000Z') }],
  ])('%s时保留原资源并返回冲突', async (_reason, overrides) => {
    const { service, transaction, em, storage } = createHarness()
    transaction.findOne.mockResolvedValue(existingAsset(overrides))

    await expect(service.upload(file, '', id)).rejects.toBeInstanceOf(ConflictException)

    expect(transaction.create).not.toHaveBeenCalled()
    expect(storage.readIfExists).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(em.fork).not.toHaveBeenCalled()
  })

  it('已有相同规范化字节的文件时复用文件并补齐媒体登记', async () => {
    const { service, transaction, storage } = createHarness()
    storage.readIfExists.mockResolvedValue(normalized.buffer)

    expect(await service.upload(file, '画面描述', id)).toMatchObject({ id, alt: '画面描述' })

    expect(storage.readIfExists).toHaveBeenCalledWith(key)
    expect(storage.put).not.toHaveBeenCalled()
    expect(transaction.create).toHaveBeenCalledTimes(1)
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('同一文件键已有不同字节时拒绝覆盖或登记', async () => {
    const { service, transaction, em, storage } = createHarness()
    storage.readIfExists.mockResolvedValue(Buffer.from('已有不同的文件内容'))

    await expect(service.upload(file, '', id)).rejects.toBeInstanceOf(ConflictException)

    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(em.fork).not.toHaveBeenCalled()
  })

  it('图片校验失败时不进入事务或触碰存储', async () => {
    const { service, em, storage } = createHarness()

    await expect(service.upload(undefined, '', id)).rejects.toBeInstanceOf(BadRequestException)

    expect(em.transactional).not.toHaveBeenCalled()
    expect(storage.readIfExists).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('新文件写入后登记失败，使用独立加锁事务确认无登记再清理', async () => {
    const { service, transaction, cleanupTransaction, cleanupManager, em, storage } = createHarness()
    transaction.flush.mockRejectedValue(new Error('登记失败'))

    await expect(service.upload(file, '', id)).rejects.toThrow('媒体保存失败，请稍后重试')

    expect(storage.put).toHaveBeenCalledWith(key, normalized.buffer)
    expect(em.fork).toHaveBeenCalledTimes(1)
    expect(cleanupManager.transactional).toHaveBeenCalledTimes(1)
    expect(cleanupTransaction.execute.mock.invocationCallOrder[0]).toBeLessThan(
      cleanupTransaction.findOne.mock.invocationCallOrder[0]!,
    )
    expect(cleanupTransaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(cleanupTransaction.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      storage.remove.mock.invocationCallOrder[0]!,
    )
    expect(storage.remove).toHaveBeenCalledTimes(1)
    expect(storage.remove).toHaveBeenCalledWith(key)
  })

  it('事务提交响应丢失但重新查询已有登记时保留文件', async () => {
    const { service, transaction, cleanupTransaction, em, storage } = createHarness()
    em.transactional.mockImplementation(async (callback) => {
      await callback(transaction as unknown as EntityManager)
      throw new Error('提交响应丢失')
    })
    cleanupTransaction.findOne.mockResolvedValue(existingAsset())

    await expect(service.upload(file, '', id)).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.put).toHaveBeenCalledTimes(1)
    expect(cleanupTransaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('补偿查询失败时保留结果不明的文件并继续返回保存错误', async () => {
    const { service, transaction, cleanupTransaction, storage } = createHarness()
    transaction.flush.mockRejectedValue(new Error('登记结果不明'))
    cleanupTransaction.findOne.mockRejectedValue(new Error('无法确认登记结果'))

    await expect(service.upload(file, '', id)).rejects.toThrow('媒体保存失败，请稍后重试')

    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('复用旧文件后登记失败时不删除此前已有的文件', async () => {
    const { service, transaction, em, storage } = createHarness()
    storage.readIfExists.mockResolvedValue(normalized.buffer)
    transaction.flush.mockRejectedValue(new Error('登记失败'))

    await expect(service.upload(file, '', id)).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(em.fork).not.toHaveBeenCalled()
  })

  it('存储写入失败时不创建登记，也不清理未经本次成功写入的文件', async () => {
    const { service, transaction, em, storage } = createHarness()
    storage.put.mockRejectedValue(new Error('存储不可用'))

    await expect(service.upload(file, '', id)).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(em.fork).not.toHaveBeenCalled()
  })
})
