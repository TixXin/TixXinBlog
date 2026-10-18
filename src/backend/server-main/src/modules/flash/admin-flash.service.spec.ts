/** @file admin-flash.service.spec.ts @description 闪念图片 URL 协议回归；使用纯内存桩确认非法输入在持久化前被拒绝。 */
import { BadRequestException } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { synchronizeMediaReferences } from '../media/media-references'
import { AdminFlashService } from './admin-flash.service'
import type { FlashService } from './flash.service'

// 只隔离媒体锁和引用写入；URL 校验运行真实 save 方法，不建立数据库连接。
jest.mock('../media/media-references', () => ({
  lockMedia: jest.fn().mockResolvedValue(undefined),
  synchronizeMediaReferences: jest.fn().mockResolvedValue(undefined),
}))

function setup() {
  const note = { id: 'flash-1', content: '正文', images: [] as string[] }
  const em = {
    transactional: jest.fn(),
    findOne: jest.fn().mockResolvedValue(note),
    flush: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(note),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  const publicFlashes = { serialize: jest.fn().mockResolvedValue([note]) }
  return {
    em,
    note,
    service: new AdminFlashService(em as unknown as EntityManager, publicFlashes as unknown as FlashService),
  }
}

describe('后台闪念图片协议', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    'http://example.com/image.webp',
    'https://example.com/image.webp',
    '/api/v1/media/12345678-1234-4123-8123-123456789abc.webp',
  ])('接受 HTTP(S) 或本站媒体图片 %s', async (url) => {
    const { em, note, service } = setup()
    await service.save(note.id, { images: [` ${url} `] })
    expect(note.images).toEqual([url])
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(em, 'flash:flash-1', 'flash', ['正文', [url]], {
      flashNote: note,
    })
  })

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'ftp://example.com/image.webp',
    'file:///tmp/image.webp',
    'https://user:password@example.com/image.webp',
    'https://user@example.com/image.webp',
    '//example.com/image.webp',
    '/outside.webp',
    'example.com/image.webp',
  ])('非法图片地址 %s 在 flush 前被拒绝', async (url) => {
    const { em, note, service } = setup()
    await expect(service.save(note.id, { images: [url] })).rejects.toThrow(BadRequestException)
    expect(em.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
  })
})
