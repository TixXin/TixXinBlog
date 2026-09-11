/** @file media-organization.spec.ts @description 素材说明的可选更新契约与真实引用业务入口。 */
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaService } from './media.service'
import type { MediaStorage } from './media-storage'
import { QueryMediaDto, UpdateMediaDto } from './media.controller'

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
      { kind: 'post', post: { id: 1, title: '文章' } },
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
    ]
    const em = { findOne: jest.fn().mockResolvedValue({}), findAndCount: jest.fn().mockResolvedValue([items, 11]) }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)
    const result = await service.references('asset', 1)
    expect(result.total).toBe(11)
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
    ])
    expect(result.items[1]).toMatchObject({ kind: 'revision', revision: 2 })
  })
})
