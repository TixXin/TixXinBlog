/**
 * @file media-recycle.spec.ts
 * @description 使用隔离的事务与存储替身验证媒体引用保护、软回收和恢复失败边界。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../../entities/media-asset.entity'
import { MediaReference } from '../../../entities/media-reference.entity'
import type { MediaStorage } from '../media-storage'
import { MediaService } from '../media.service'

const id = '12345678-1234-4123-8123-123456789abc'

function setup() {
  const asset = Object.assign(new MediaAsset(), {
    id,
    originalName: '山间晨光.png',
    storageKey: `${id}.webp`,
    mimeType: 'image/webp',
    byteSize: 48,
    width: 4,
    height: 3,
    sha256: 'a'.repeat(64),
    alt: '晨光穿过山间薄雾',
    description: '旅行途中拍摄',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  })
  const transaction = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(asset),
    count: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 根管理器与事务管理器分离，避免错误使用事务外查询也能通过测试。
  const em = {
    transactional: jest.fn(async (action: (manager: EntityManager) => Promise<unknown>) =>
      action(transaction as unknown as EntityManager),
    ),
    findOne: jest.fn().mockResolvedValue(asset),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  }
  const storage = {
    get: jest.fn().mockResolvedValue(Buffer.from('已有图片内容')),
    put: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    removeVariants: jest.fn().mockResolvedValue(2),
  }
  const service = new MediaService(em as unknown as EntityManager, storage as unknown as MediaStorage)
  return { asset, transaction, em, storage, service }
}

describe('媒体回收与恢复', () => {
  it.each(['remove', 'restore'] as const)('%s 获取共用锁失败时不查询或改写媒体', async (method) => {
    const { service, transaction, storage } = setup()
    const error = new Error('锁获取失败')
    transaction.execute.mockRejectedValue(error)

    await expect(service[method](id)).rejects.toBe(error)

    expect(transaction.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(transaction.findOne).not.toHaveBeenCalled()
    expect(transaction.count).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it.each(['remove', 'restore'] as const)('%s 不存在的媒体返回 404 且不操作文件', async (method) => {
    const { service, transaction, storage } = setup()
    transaction.findOne.mockResolvedValue(null)

    await expect(service[method](id)).rejects.toMatchObject({ status: 404, message: '媒体不存在' })

    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(transaction.execute.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.findOne.mock.invocationCallOrder[0]!,
    )
    expect(transaction.count).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it.each([1, 3])('存在 %i 处任意业务或历史引用时拒绝回收', async (count) => {
    const { service, asset, transaction, storage } = setup()
    transaction.count.mockResolvedValue(count)

    await expect(service.remove(id)).rejects.toMatchObject({
      status: 409,
      message: `媒体仍有 ${count} 处引用（含历史修订），不能移除`,
    })

    // 查询不得附加公开状态、引用种类或当前版本过滤，否则会漏掉私有内容与历史保护。
    expect(transaction.count).toHaveBeenCalledTimes(1)
    expect(transaction.count).toHaveBeenCalledWith(MediaReference, { asset: id })
    expect(asset.deletedAt).toBeUndefined()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it('无引用媒体在锁内软回收，持久化后只清理派生变体并保留原图', async () => {
    const { service, asset, transaction, em, storage } = setup()
    const startedAt = Date.now()

    await expect(service.remove(id)).resolves.toEqual({ ok: true })

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.findOne).not.toHaveBeenCalled()
    expect(transaction.execute).toHaveBeenCalledTimes(1)
    expect(transaction.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(transaction.findOne).toHaveBeenCalledTimes(1)
    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(transaction.count).toHaveBeenCalledTimes(1)
    expect(transaction.count).toHaveBeenCalledWith(MediaReference, { asset: id })
    expect(asset.deletedAt).toBeInstanceOf(Date)
    expect(asset.deletedAt!.getTime()).toBeGreaterThanOrEqual(startedAt)
    expect(asset.deletedAt!.getTime()).toBeLessThanOrEqual(Date.now())
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.removeVariants).toHaveBeenCalledTimes(1)
    expect(storage.removeVariants).toHaveBeenCalledWith(asset.storageKey)
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
    const order = [
      transaction.execute,
      transaction.findOne,
      transaction.count,
      transaction.flush,
      storage.removeVariants,
    ].map((mock) => mock.mock.invocationCallOrder[0]!)
    expect(order).toEqual([...order].sort((left, right) => left - right))
  })

  it('回收持久化失败时保留错误，不清理文件或变体', async () => {
    const { service, transaction, storage } = setup()
    const error = new Error('持久化失败')
    transaction.flush.mockRejectedValue(error)

    await expect(service.remove(id)).rejects.toBe(error)

    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it('派生变体清理失败不撤销软回收，也不删除原图', async () => {
    const { service, asset, transaction, storage } = setup()
    storage.removeVariants.mockRejectedValue(new Error('缓存目录暂不可写'))

    await expect(service.remove(id)).resolves.toEqual({ ok: true })

    expect(asset.deletedAt).toBeInstanceOf(Date)
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.removeVariants).toHaveBeenCalledWith(asset.storageKey)
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('原图不可读取时返回 503 并保持回收状态', async () => {
    const { service, asset, transaction, storage } = setup()
    const deletedAt = new Date('2026-02-01T00:00:00.000Z')
    asset.deletedAt = deletedAt
    storage.get.mockRejectedValue(new Error('文件缺失或无读取权限'))

    await expect(service.restore(id)).rejects.toMatchObject({
      status: 503,
      message: '文件暂不可用，不能恢复',
    })

    expect(storage.get).toHaveBeenCalledTimes(1)

    expect(storage.get).toHaveBeenCalledWith(asset.storageKey)
    expect(asset.deletedAt).toBe(deletedAt)
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it('原图可读取时在事务内恢复登记，保留图片资料与字节', async () => {
    const { service, asset, transaction, em, storage } = setup()
    asset.deletedAt = new Date('2026-02-01T00:00:00.000Z')

    await expect(service.restore(id)).resolves.toEqual({
      id,
      name: '山间晨光.png',
      url: `/api/v1/media/${id}.webp`,
      alt: '晨光穿过山间薄雾',
      description: '旅行途中拍摄',
      width: 4,
      height: 3,
      byteSize: 48,
      mimeType: 'image/webp',
      createdAt: '2026-01-01T00:00:00.000Z',
      deleted: false,
    })

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.findOne).not.toHaveBeenCalled()
    expect(transaction.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(storage.get).toHaveBeenCalledTimes(1)
    expect(storage.get).toHaveBeenCalledWith(asset.storageKey)
    expect(asset.deletedAt).toBeUndefined()
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.get.mock.invocationCallOrder[0]).toBeLessThan(transaction.flush.mock.invocationCallOrder[0]!)
    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })

  it('恢复持久化失败时不得返回成功', async () => {
    const { service, asset, transaction, storage } = setup()
    asset.deletedAt = new Date('2026-02-01T00:00:00.000Z')
    const error = new Error('持久化失败')
    transaction.flush.mockRejectedValue(error)

    await expect(service.restore(id)).rejects.toBe(error)

    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })
})

describe('媒体引用明细', () => {
  it('媒体不存在时返回 404，不读取引用列表', async () => {
    const { service, em } = setup()
    em.findOne.mockResolvedValue(null)

    await expect(service.references(id, 1)).rejects.toMatchObject({ status: 404, message: '媒体不存在' })

    expect(em.findAndCount).not.toHaveBeenCalled()
  })

  it('回收媒体仍可查询引用，按稳定顺序分页且不筛掉历史记录', async () => {
    const { service, asset, em } = setup()
    asset.deletedAt = new Date('2026-02-01T00:00:00.000Z')
    em.findAndCount.mockResolvedValue([
      [
        { kind: 'site-revision', revision: 7 },
        { kind: 'subscription', subscription: { id: 12, name: '云存储' } },
        { kind: 'image-prompt', imagePrompt: { id: 8, title: '山间晨光' } },
      ],
      23,
    ])

    await expect(service.references(id, 2)).resolves.toEqual({
      page: 2,
      pageSize: 20,
      total: 23,
      items: [
        { kind: 'site-revision', revision: 7, title: '站点头像', url: '/admin/site' },
        { kind: 'subscription', title: '云存储', url: '/admin/subscriptions/12' },
        { kind: 'image-prompt', title: '山间晨光', url: '/prompts?edit=8' },
      ],
    })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(MediaAsset, { id })
    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount).toHaveBeenCalledWith(
      MediaReference,
      { asset: id },
      {
        populate: [
          'post',
          'flashNote',
          'moment',
          'guestbookMessage',
          'galleryPhoto',
          'project',
          'subscription',
          'friendLink',
          'imagePrompt',
        ],
        orderBy: { id: 'asc' },
        limit: 20,
        offset: 20,
      },
    )
  })
})
