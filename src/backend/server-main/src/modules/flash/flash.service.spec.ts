/**
 * @file flash.service.spec.ts
 * @description 闪念评论回归：公开 authorId 不暴露访客哈希、跨模块不可关联，头像复用白名单校验
 */
import { createHash } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { FlashNote } from '../../entities/flash-note.entity'
import { FlashService } from './flash.service'

const secret = 'flash-test-secret-with-at-least-32-characters'
const visitor = createHash('sha256').update('visitor-device-1').digest('hex')

function setup(config: Record<string, string> = { JWT_ACCESS_SECRET: secret }) {
  const note = { id: 'note-1', likes: 0 }
  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(note),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 'comment-1', ...data })),
    flush: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    nativeDelete: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { em, service: new FlashService(em as unknown as EntityManager, new ConfigService(config)) }
}

const dto = { authorName: '访客', content: '写得真好' }

describe('FlashService 评论身份', () => {
  it('公开 authorId 为稳定的 20 位 HMAC，不等于访客哈希或留言成员编号', async () => {
    const { service, em } = setup()
    const created = await service.addComment('note-1', dto, visitor)
    expect(em.create).toHaveBeenCalledWith(FlashComment, expect.objectContaining({ authorId: visitor }))
    expect(created.authorId).toMatch(/^[0-9a-f]{20}$/)
    expect(created.authorId).not.toBe(visitor)
    expect(visitor).not.toContain(created.authorId)
    const member = createHash('sha256')
      .update('member:' + visitor)
      .digest('hex')
      .slice(0, 20)
    expect(created.authorId).not.toBe(member)
    expect((await service.addComment('note-1', dto, visitor)).authorId).toBe(created.authorId)
    expect((await service.addComment('note-1', dto, 'another-visitor')).authorId).not.toBe(created.authorId)
  })

  it('换用密钥后标识随之变化，列表序列化同样不返回原始哈希', async () => {
    const first = setup()
    const second = setup({ JWT_ACCESS_SECRET: secret.replace('flash', 'other') })
    const note = {
      id: 'note-1',
      userId: 'tixxin',
      content: '',
      tags: [],
      images: [],
      type: 'text',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      likes: 0,
      comments: {
        getItems: () => [
          { id: 'c1', authorId: visitor, authorName: '访客', authorAvatar: '', content: 'x', createdAt: new Date(0) },
        ],
      },
      isPinned: false,
      isArchived: false,
      isDraft: false,
    } as unknown as FlashNote
    const [a] = await first.service.serialize([note], '')
    const [b] = await second.service.serialize([note], '')
    expect(a!.comments[0]!.authorId).toMatch(/^[0-9a-f]{20}$/)
    expect(a!.comments[0]!.authorId).not.toBe(visitor)
    expect(a!.comments[0]!.authorId).not.toBe(b!.comments[0]!.authorId)
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', '/etc/passwd'])(
    '拒绝头像 %s',
    async (authorAvatar) => {
      const { service, em } = setup()
      await expect(service.addComment('note-1', { ...dto, authorAvatar }, visitor)).rejects.toMatchObject({
        status: 400,
      })
      expect(em.create).not.toHaveBeenCalled()
    },
  )

  it('缺省使用默认头像，合法 HTTPS 头像与空值保持原有行为', async () => {
    const { service } = setup()
    expect((await service.addComment('note-1', dto, visitor)).authorAvatar).toBe('/avatar.svg')
    expect(
      (await service.addComment('note-1', { ...dto, authorAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=1&s=100' }, visitor))
        .authorAvatar,
    ).toBe('https://q1.qlogo.cn/g?b=qq&nk=1&s=100')
    expect((await service.addComment('note-1', { ...dto, authorAvatar: '' }, visitor)).authorAvatar).toBe('')
  })
})
