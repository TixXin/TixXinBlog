/** @file media-organization.spec.ts @description 素材说明、真实引用分页与回收时的事务引用保护。 */
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { MediaService } from './media.service'
import type { MediaStorage } from './media-storage'
import { QueryMediaDto, UpdateMediaDto } from './media.controller'

function removalContext(asset: MediaAsset | null = Object.assign(new MediaAsset(), { storageKey: 'photo.webp' })) {
  const transaction = {
    execute: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(asset),
    count: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  const em = {
    transactional: jest.fn((operation: (manager: EntityManager) => Promise<unknown>) =>
      operation(transaction as unknown as EntityManager),
    ),
  }
  const storage = {
    remove: jest.fn().mockResolvedValue(undefined),
    removeVariants: jest.fn().mockResolvedValue(0),
  }
  return {
    asset,
    transaction,
    em,
    storage,
    service: new MediaService(em as unknown as EntityManager, storage as unknown as MediaStorage),
  }
}

describe('媒体整理契约', () => {
  it('素材说明可单独更新，未传字段保持缺省而非强制写空', async () => {
    expect(await validate(plainToInstance(UpdateMediaDto, { description: '来源及使用说明' }))).toHaveLength(0)
    expect(await validate(plainToInstance(UpdateMediaDto, { alt: '替代文本' }))).toHaveLength(0)
    expect(await validate(plainToInstance(UpdateMediaDto, {}))).toHaveLength(0)
    expect(await validate(plainToInstance(UpdateMediaDto, { description: null }))).not.toHaveLength(0)
    expect(await validate(plainToInstance(UpdateMediaDto, { description: '长'.repeat(1001) }))).not.toHaveLength(0)
    expect(await validate(plainToInstance(UpdateMediaDto, { alt: null }))).not.toHaveLength(0)
  })
  it('只接受真实尺寸与引用状态筛选', async () => {
    expect(await validate(plainToInstance(QueryMediaDto, { orientation: 'portrait', usage: 'used' }))).toHaveLength(0)
    expect(await validate(plainToInstance(QueryMediaDto, { orientation: 'unknown', usage: 'popular' }))).toHaveLength(2)
  })
  it('更新说明不覆盖替代文本，旧调用只更新替代文本不覆盖说明', async () => {
    const asset = Object.assign(new MediaAsset(), {
      alt: '画面内容',
      description: '图片出处',
      originalName: 'photo.webp',
    })
    const em = { findOne: jest.fn().mockResolvedValue(asset), flush: jest.fn() }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)
    expect(await service.update(asset.id, { description: '用途备注' })).toMatchObject({
      alt: '画面内容',
      description: '用途备注',
    })
    expect(await service.update(asset.id, { alt: '更新画面内容' })).toMatchObject({
      alt: '更新画面内容',
      description: '用途备注',
    })
    expect(await service.update(asset.id, {})).toMatchObject({ alt: '更新画面内容', description: '用途备注' })
  })
  it('当前与历史引用数量原样返回，导航使用已有正式业务上下文', async () => {
    const items = [
      // 当前内容引用的 revision 列在数据库中为 null
      { kind: 'post', revision: null, post: { id: 1, title: '文章' } },
      { kind: 'revision', revision: 2, post: { id: 1, title: '文章' } },
      { kind: 'comment', comment: { id: 9 }, post: { id: 1, title: '文章' } },
      { kind: 'flash', flashNote: { id: 'flash-a', content: '闪念' } },
      { kind: 'moment', moment: { id: 'moment-a', content: '动态' } },
      { kind: 'gallery', galleryPhoto: { id: 8, title: '作品' } },
      { kind: 'project', project: { id: 7, title: '项目' } },
      { kind: 'link', friendLink: { id: 6, name: '友链' } },
      { kind: 'guestbook', guestbookMessage: { id: 5, content: '留言' } },
      { kind: 'moment-comment', moment: { id: 'moment-a', content: '动态' }, momentComment: { id: 'reply-a' } },
      { kind: 'flash-comment', flashNote: { id: 'flash-a', content: '闪念' }, flashComment: { id: 'reply-b' } },
      { kind: 'subscription', subscription: { id: 4, name: '平台订阅' } },
      { kind: 'image-prompt', imagePrompt: { id: 3, title: '图片提示词' } },
      { kind: 'site' },
      { kind: 'site-revision', revision: 5 },
    ]
    const em = { findOne: jest.fn().mockResolvedValue({}), findAndCount: jest.fn().mockResolvedValue([items, 15]) }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)
    const result = await service.references('asset', 1)
    expect(result.total).toBe(15)
    expect(result.items.map((item) => item.url)).toEqual([
      '/admin/posts/1',
      '/admin/posts/1',
      '/admin/comments?commentId=9',
      '/admin/flashes?edit=flash-a',
      '/admin/moments/moment-a',
      '/admin/gallery/8',
      '/admin/projects/7',
      '/admin/links/6',
      '/admin/guestbook?focus=5',
      '/admin/moments?comments=moment-a&commentId=reply-a',
      '/admin/flashes?comments=flash-a&commentId=reply-b',
      '/admin/subscriptions/4',
      '/prompts?edit=3',
      '/admin/site',
      '/admin/site',
    ])
    expect(result.items[0]).toMatchObject({ kind: 'post', revision: null })
    expect(result.items[1]).toMatchObject({ kind: 'revision', revision: 2 })
    expect(result.items[11]).toMatchObject({ title: '平台订阅' })
    expect(result.items[12]).toMatchObject({ title: '图片提示词' })
    expect(result.items[14]).toMatchObject({ kind: 'site-revision', revision: 5, title: '站点头像' })
  })
  it('引用按稳定顺序返回第二页，保留完整总数且不按公开状态过滤', async () => {
    const item = { kind: 'revision', revision: 21, post: { id: 1, title: '草稿文章', status: 'draft' } }
    const em = {
      findOne: jest.fn().mockResolvedValue({}),
      findAndCount: jest.fn().mockResolvedValue([[item], 21]),
    }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)

    await expect(service.references('asset', 2)).resolves.toEqual({
      total: 21,
      page: 2,
      pageSize: 20,
      items: [{ kind: 'revision', revision: 21, title: '草稿文章', url: '/admin/posts/1' }],
    })
    expect(em.findOne).toHaveBeenCalledWith(MediaAsset, { id: 'asset' })
    expect(em.findAndCount).toHaveBeenCalledWith(
      MediaReference,
      { asset: 'asset' },
      expect.objectContaining({ orderBy: { id: 'asc' }, limit: 20, offset: 20 }),
    )
  })
  it('没有引用时返回空页，媒体不存在时不继续读取引用', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({}),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)
    await expect(service.references('asset', 1)).resolves.toEqual({ total: 0, page: 1, pageSize: 20, items: [] })
    em.findOne.mockResolvedValueOnce(null)
    em.findAndCount.mockClear()
    await expect(service.references('missing', 1)).rejects.toBeInstanceOf(NotFoundException)
    expect(em.findAndCount).not.toHaveBeenCalled()
  })
})

describe('媒体回收引用保护', () => {
  it('获取共享锁后重新统计全部引用，等待锁时新增的引用仍会阻止回收', async () => {
    const { service, asset, transaction, em, storage } = removalContext()
    let releaseLock!: () => void
    transaction.execute.mockReturnValue(new Promise<void>((resolve) => (releaseLock = resolve)))

    const operation = service.remove('asset')
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(transaction.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(transaction.findOne).not.toHaveBeenCalled()
    expect(transaction.count).not.toHaveBeenCalled()

    // 模拟内容写入先持有共享锁并补充引用，再让媒体回收取得锁。
    transaction.count.mockResolvedValue(3)
    releaseLock()
    await expect(operation).rejects.toMatchObject({
      status: 409,
      message: '媒体仍有 3 处引用（含历史修订），不能移除',
    })
    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id: 'asset' })
    expect(transaction.count).toHaveBeenCalledWith(MediaReference, { asset: 'asset' })
    expect(asset?.deletedAt).toBeUndefined()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })
  it('未引用媒体仅软删除并清理其变体，保留原始受管文件供恢复', async () => {
    const { service, asset, transaction, storage } = removalContext()

    await expect(service.remove('asset')).resolves.toEqual({ ok: true })
    expect(asset?.deletedAt).toBeInstanceOf(Date)
    expect(transaction.count).toHaveBeenCalledWith(MediaReference, { asset: 'asset' })
    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(storage.removeVariants).toHaveBeenCalledWith('photo.webp')
    expect(storage.remove).not.toHaveBeenCalled()
    expect(transaction.count.mock.invocationCallOrder[0]).toBeLessThan(transaction.flush.mock.invocationCallOrder[0]!)
    expect(transaction.flush.mock.invocationCallOrder[0]).toBeLessThan(
      storage.removeVariants.mock.invocationCallOrder[0]!,
    )
  })
  it('仅剩历史引用也不可回收，不依赖当前内容公开或存在', async () => {
    const { service, transaction, storage } = removalContext()
    transaction.count.mockResolvedValue(1)

    await expect(service.remove('asset')).rejects.toBeInstanceOf(ConflictException)
    expect(transaction.count).toHaveBeenCalledWith(MediaReference, { asset: 'asset' })
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
  })
  it('媒体不存在时拒绝回收且不统计引用或操作文件', async () => {
    const { service, transaction, storage } = removalContext(null)

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException)
    expect(transaction.count).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(storage.removeVariants).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it('软删除持久化失败时保留缓存文件并把错误交还调用方', async () => {
    const { service, transaction, storage } = removalContext()
    transaction.flush.mockRejectedValue(new Error('持久化失败'))

    await expect(service.remove('asset')).rejects.toThrow('持久化失败')
    expect(storage.removeVariants).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })
})
