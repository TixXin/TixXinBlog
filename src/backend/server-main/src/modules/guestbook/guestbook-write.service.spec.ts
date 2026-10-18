/**
 * @file guestbook-write.service.spec.ts
 * @description 留言创建的审核、身份、幂等、回复与事务边界，以及浏览器和可信地区来源记录
 */
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { Request } from 'express'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { synchronizeMediaReferences } from '../media/media-references'
import { recordOwnerEvent } from '../operations/owner-events'
import type { AdminGuestbookBatchService } from './admin-guestbook-batch.service'
import { AdminGuestbookController } from './admin-guestbook.controller'
import { GuestbookController } from './guestbook.controller'
import type { CreateGuestbookDto, GuestbookBodyDto } from './guestbook.dto'
import type { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'

jest.mock('../media/media-references', () => ({
  ...jest.requireActual<typeof import('../media/media-references')>('../media/media-references'),
  synchronizeMediaReferences: jest.fn(),
}))
jest.mock('../operations/owner-events', () => ({ recordOwnerEvent: jest.fn() }))

const syncReferences = jest.mocked(synchronizeMediaReferences)
const ownerEvent = jest.mocked(recordOwnerEvent)
const visitor = 'visitor-hash-a'
const input: CreateGuestbookDto = {
  requestId: 'b84c2a1f-5ec4-4f08-96f3-3fbe240e19a2',
  author: '山间来客',
  content: '这篇关于山间步道的记录让我也想出门走走。',
}

function setup(requireApproval = false, config?: ConfigService) {
  const policy = { requireApproval }
  const site = { values: { ownerName: '小新', avatar: '/avatar-photo.webp' } }
  const tx = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn(async (entity: unknown) => {
      if (entity === CommentPolicy) return policy
      if (entity === SiteSettings) return site
      throw new Error('未配置的实体读取')
    }),
    create: jest.fn((_entity: unknown, values: Partial<GuestbookMessage>) =>
      Object.assign(new GuestbookMessage(), { id: 42 }, values),
    ),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 根管理器只提供事务入口，防止写入意外使用事务外的管理器。
  const em = { transactional: jest.fn(async (run: (manager: unknown) => Promise<unknown>) => run(tx)) }
  const detail = { id: 42, content: input.content }
  const read = { detail: jest.fn().mockResolvedValue(detail) }
  const service = new GuestbookWriteService(
    em as unknown as EntityManager,
    read as unknown as GuestbookReadService,
    config,
  )
  return { service, em, tx, read, detail, site }
}

beforeEach(() => {
  syncReferences.mockReset().mockResolvedValue(undefined)
  ownerEvent.mockReset().mockResolvedValue(undefined)
})

describe('GuestbookWriteService 创建留言', () => {
  it.each([
    { requireApproval: true, status: 'pending', reason: 'pending_review' },
    { requireApproval: false, status: 'published', reason: 'new_guestbook' },
  ])('审核开关 $requireApproval 决定状态 $status 与通知原因', async ({ requireApproval, status, reason }) => {
    const { service, em, tx, read, detail } = setup(requireApproval)
    // 即使绕过 DTO 传入身份和状态字段，访客也不能冒充博主或自行公开。
    const body = { ...input, isOwner: true, status: 'published', isPinned: true, visitorIdHash: 'forged' }
    expect(await service.create(body, visitor)).toBe(detail)

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenNthCalledWith(1, 'select pg_advisory_xact_lock(742912)')
    expect(tx.execute).toHaveBeenNthCalledWith(2, 'select pg_advisory_xact_lock(742920)')
    expect(tx.execute.mock.invocationCallOrder[1]).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]!)
    expect(tx.findOne).toHaveBeenCalledWith(GuestbookMessage, { visitorIdHash: visitor, requestId: input.requestId })
    expect(tx.findOneOrFail).toHaveBeenCalledTimes(1)
    expect(tx.findOneOrFail).toHaveBeenCalledWith(CommentPolicy, { id: 'default' }, { refresh: true })
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.create).toHaveBeenCalledWith(GuestbookMessage, {
      author: input.author,
      content: input.content,
      avatar: '',
      visitorIdHash: visitor,
      isOwner: false,
      status,
      replyTo: null,
      requestId: input.requestId,
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      browser: null,
      region: null,
    })
    const note = tx.create.mock.results[0]!.value as GuestbookMessage
    expect(note.isPinned).toBe(false)
    expect(syncReferences).toHaveBeenCalledWith(tx, 'guestbook:42', 'guestbook', [''], { guestbookMessage: note })
    expect(ownerEvent).toHaveBeenCalledWith(tx, 'guestbook', 42, reason)
    expect(tx.flush).toHaveBeenCalledTimes(2)
    expect(tx.flush.mock.invocationCallOrder[0]).toBeLessThan(syncReferences.mock.invocationCallOrder[0]!)
    expect(syncReferences.mock.invocationCallOrder[0]).toBeLessThan(tx.flush.mock.invocationCallOrder[1]!)
    expect(tx.flush.mock.invocationCallOrder[1]).toBeLessThan(ownerEvent.mock.invocationCallOrder[0]!)
    expect(read.detail).toHaveBeenCalledWith(42, visitor, false)
  })

  it('博主身份和头像取自站点配置，直接公开且不生成给自己的通知', async () => {
    const { service, tx, read, site } = setup(true)
    const body = { ...input, author: '伪造昵称', avatar: 'https://example.com/forged.png' }
    await service.create(body, visitor, 'owner-1', { browser: 'Firefox 131', region: '新加坡' })

    expect(tx.findOne).toHaveBeenCalledWith(GuestbookMessage, {
      visitorIdHash: 'admin:owner-1',
      requestId: input.requestId,
    })
    expect(tx.findOneOrFail).toHaveBeenCalledWith(SiteSettings, { id: 'default' })
    expect(tx.create).toHaveBeenCalledWith(
      GuestbookMessage,
      expect.objectContaining({
        author: site.values.ownerName,
        avatar: site.values.avatar,
        visitorIdHash: 'admin:owner-1',
        isOwner: true,
        status: 'published',
        browser: 'Firefox 131',
        region: '新加坡',
      }),
    )
    expect(syncReferences).toHaveBeenCalledWith(tx, 'guestbook:42', 'guestbook', [site.values.avatar], {
      guestbookMessage: expect.objectContaining({ id: 42 }),
    })
    expect(ownerEvent).not.toHaveBeenCalled()
    expect(read.detail).toHaveBeenCalledWith(42, visitor, true)
  })

  it('访客来源采用请求上下文参数，忽略正文中伪造的来源', async () => {
    const { service, tx } = setup()
    const body = { ...input, browser: '伪造浏览器', region: '伪造地区' }
    await service.create(body, visitor, undefined, { browser: 'Chrome 130', region: '广东 深圳' })
    expect(tx.create).toHaveBeenCalledWith(
      GuestbookMessage,
      expect.objectContaining({ browser: 'Chrome 130', region: '广东 深圳' }),
    )
  })

  it('空来源保存为 null，兼容没有来源信息的请求', async () => {
    const { service, tx } = setup()
    await service.create(input, visitor, undefined, { browser: '', region: '' })
    expect(tx.create).toHaveBeenCalledWith(GuestbookMessage, expect.objectContaining({ browser: null, region: null }))
  })

  it.each([undefined, 'owner-1'])('身份 %s 回复时只查找公开且未删除的父留言', async (adminId) => {
    const { service, tx } = setup()
    const parent = Object.assign(new GuestbookMessage(), { id: 7, content: '欢迎来聊聊。' })
    tx.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(parent)
    await service.create({ ...input, replyToId: 7 }, visitor, adminId)
    expect(tx.findOne).toHaveBeenNthCalledWith(2, GuestbookMessage, { id: 7, status: 'published', deletedAt: null })
    expect(tx.create).toHaveBeenCalledWith(GuestbookMessage, expect.objectContaining({ replyTo: parent }))
  })

  it('父留言不存在或不可公开时返回 404，不创建留言、媒体引用或通知', async () => {
    const { service, tx, read } = setup()
    await expect(service.create({ ...input, replyToId: 7 }, visitor)).rejects.toMatchObject({ status: 404 })
    expect(tx.findOneOrFail).not.toHaveBeenCalled()
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
    expect(syncReferences).not.toHaveBeenCalled()
    expect(ownerEvent).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it.each([-1, 1.5, 2147483648])('非法回复编号 %s 在查找父留言前被拒绝', async (replyToId) => {
    const { service, tx } = setup()
    await expect(service.create({ ...input, replyToId }, visitor)).rejects.toMatchObject({ status: 400 })
    expect(tx.findOne).toHaveBeenCalledTimes(1)
    expect(tx.create).not.toHaveBeenCalled()
  })

  it.each([
    ['/avatar.svg', '/avatar.svg'],
    [' https://example.com/avatar.png ', 'https://example.com/avatar.png'],
    [
      '/api/v1/media/B84C2A1F-5EC4-4F08-96F3-3FBE240E19A2.webp',
      '/api/v1/media/b84c2a1f-5ec4-4f08-96f3-3fbe240e19a2.webp',
    ],
  ])('头像 %s 规范化后用于留言和媒体引用', async (avatar, expected) => {
    const { service, tx } = setup()
    await service.create({ ...input, avatar }, visitor)
    expect(tx.create).toHaveBeenCalledWith(GuestbookMessage, expect.objectContaining({ avatar: expected }))
    expect(syncReferences).toHaveBeenCalledWith(tx, 'guestbook:42', 'guestbook', [expected], {
      guestbookMessage: expect.objectContaining({ id: 42 }),
    })
  })

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '//example.com/avatar.png',
    'https://user:pass@example.com/a',
  ])('拒绝不安全头像 %s，不产生写入副作用', async (avatar) => {
    const { service, tx, read } = setup()
    await expect(service.create({ ...input, avatar }, visitor)).rejects.toMatchObject({ status: 400 })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
    expect(syncReferences).not.toHaveBeenCalled()
    expect(ownerEvent).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('所有事务工作完成后才读取结果，提交失败不返回成功详情', async () => {
    const { service, em, tx, read } = setup()
    const error = new Error('事务提交失败')
    em.transactional.mockImplementationOnce(async (run) => {
      await run(tx)
      expect(read.detail).not.toHaveBeenCalled()
      throw error
    })
    await expect(service.create(input, visitor)).rejects.toBe(error)
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('媒体引用失败向事务调用方传播，不继续生成通知或返回详情', async () => {
    const { service, tx, read } = setup()
    const error = new Error('媒体已被移除')
    syncReferences.mockRejectedValueOnce(error)
    await expect(service.create(input, visitor)).rejects.toBe(error)
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(ownerEvent).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('通知记录失败不被吞掉，也不返回创建成功', async () => {
    const { service, read } = setup()
    const error = new Error('通知记录失败')
    ownerEvent.mockRejectedValueOnce(error)
    await expect(service.create(input, visitor)).rejects.toBe(error)
    expect(read.detail).not.toHaveBeenCalled()
  })
})

describe('GuestbookWriteService 创建幂等', () => {
  it.each([true, false])('审核开关 %s 下重试同一提交复用原记录，不重复写入或更换来源', async (requireApproval) => {
    const { service, tx, read } = setup(requireApproval)
    await service.create(input, visitor, undefined, { browser: 'Chrome 130', region: '浙江 杭州' })
    const original = tx.create.mock.results[0]!.value as GuestbookMessage
    tx.findOne.mockResolvedValueOnce(original)
    // 省略与显式 null 的回复等价，字段顺序和展示来源不影响原提交的身份。
    const retry = { content: input.content, author: input.author, requestId: input.requestId, replyToId: null }
    await service.create(retry, visitor, undefined, { browser: 'Safari 18', region: '上海' })

    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.findOneOrFail).toHaveBeenCalledTimes(1)
    expect(tx.flush).toHaveBeenCalledTimes(2)
    expect(syncReferences).toHaveBeenCalledTimes(1)
    expect(ownerEvent).toHaveBeenCalledTimes(1)
    expect(read.detail).toHaveBeenCalledTimes(2)
    expect(original).toMatchObject({ browser: 'Chrome 130', region: '浙江 杭州' })
  })

  it.each([{ content: '修改后的正文' }, { author: '另一位来客' }, { avatar: '/avatar.svg' }, { replyToId: 7 }])(
    '同一提交标识携带不同内容 %j 时冲突，保留原留言',
    async (patch) => {
      const { service, tx, read } = setup()
      await service.create(input, visitor)
      const original = tx.create.mock.results[0]!.value as GuestbookMessage
      tx.findOne.mockResolvedValueOnce(original)
      await expect(service.create({ ...input, ...patch }, visitor)).rejects.toMatchObject({ status: 409 })
      expect(tx.create).toHaveBeenCalledTimes(1)
      expect(tx.flush).toHaveBeenCalledTimes(2)
      expect(syncReferences).toHaveBeenCalledTimes(1)
      expect(ownerEvent).toHaveBeenCalledTimes(1)
      expect(read.detail).toHaveBeenCalledTimes(1)
      expect(original).toMatchObject({ content: input.content, author: input.author, avatar: '', replyTo: null })
    },
  )

  it.each(['hidden', 'deleted'] as const)('访客旧提交已 %s 时不能通过重试恢复', async (state) => {
    const { service, tx, read } = setup()
    await service.create(input, visitor)
    const original = tx.create.mock.results[0]!.value as GuestbookMessage
    if (state === 'hidden') original.status = 'hidden'
    else original.deletedAt = new Date('2026-10-18T00:00:00.000Z')
    tx.findOne.mockResolvedValueOnce(original)
    await expect(service.create(input, visitor)).rejects.toMatchObject({ status: 409 })
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.flush).toHaveBeenCalledTimes(2)
    expect(ownerEvent).toHaveBeenCalledTimes(1)
    expect(read.detail).toHaveBeenCalledTimes(1)
  })

  it('博主可读取自己已隐藏的原提交，删除后同样禁止重试恢复', async () => {
    const { service, tx, read } = setup()
    const body: GuestbookBodyDto = { requestId: input.requestId, content: input.content }
    await service.create(body, '', 'owner-1')
    const original = tx.create.mock.results[0]!.value as GuestbookMessage
    original.status = 'hidden'
    tx.findOne.mockResolvedValue(original)
    await service.create(body, '', 'owner-1')
    expect(read.detail).toHaveBeenLastCalledWith(42, '', true)
    expect(original.status).toBe('hidden')
    original.deletedAt = new Date('2026-10-18T00:00:00.000Z')
    await expect(service.create(body, '', 'owner-1')).rejects.toMatchObject({ status: 409 })
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(syncReferences).toHaveBeenCalledTimes(1)
    expect(ownerEvent).not.toHaveBeenCalled()
    expect(read.detail).toHaveBeenCalledTimes(2)
  })
})

function request(headers: Record<string, string> = {}, trusted = true) {
  const trust = jest.fn(() => trusted)
  const get = jest.fn((name: string) => headers[name.toLowerCase()])
  const value = {
    app: { get: jest.fn((name: string) => (name === 'trust proxy fn' ? trust : undefined)) },
    socket: { remoteAddress: '192.0.2.10' },
    get,
  } as unknown as Request
  return { value, trust, get }
}

describe('GuestbookWriteService 来源解析', () => {
  it('未注入配置时读取默认地区头，浏览器只保留家族与主版本', () => {
    const { service } = setup()
    const { value, trust, get } = request({
      'user-agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'x-client-region': ' 广东  深圳 ',
    })
    expect(service.clientContext(value)).toEqual({ browser: 'Edge 130', region: '广东 深圳' })
    expect(get).toHaveBeenCalledWith('user-agent')
    expect(get).toHaveBeenCalledWith('x-client-region')
    expect(trust).toHaveBeenCalledWith('192.0.2.10', 0)
  })

  it.each([undefined, ''])('配置地区头为 %s 时仍回落默认名称', (header) => {
    const { service } = setup(false, new ConfigService({ CLIENT_REGION_HEADER: header }))
    const { value } = request({ 'x-client-region': '新加坡' })
    expect(service.clientContext(value)).toEqual({ browser: '', region: '新加坡' })
  })

  it('配置自定义地区头时不读取同名默认头', () => {
    const { service } = setup(false, new ConfigService({ CLIENT_REGION_HEADER: 'x-edge-region' }))
    const { value, get } = request({ 'x-edge-region': '江苏 南京', 'x-client-region': '伪造地区' })
    expect(service.clientContext(value)).toEqual({ browser: '', region: '江苏 南京' })
    expect(get).toHaveBeenCalledWith('x-edge-region')
    expect(get).not.toHaveBeenCalledWith('x-client-region')
  })

  it('不可信连接中的地区头被忽略，浏览器信息仍可解析', () => {
    const { service } = setup()
    const { value, get } = request({ 'user-agent': 'Firefox/131.0', 'x-client-region': '伪造地区' }, false)
    expect(service.clientContext(value)).toEqual({ browser: 'Firefox 131', region: '' })
    expect(get).not.toHaveBeenCalledWith('x-client-region')
  })

  it('缺少代理信任信息时不采信地区，异常或超长来源退为空值', () => {
    const { service } = setup()
    expect(service.clientContext({ get: () => undefined } as unknown as Request)).toEqual({ browser: '', region: '' })
    const { value } = request({ 'user-agent': 'x'.repeat(513), 'x-client-region': '地'.repeat(41) })
    expect(service.clientContext(value)).toEqual({ browser: '', region: '' })
  })

  it('公开和博主创建入口都把解析后的来源传入写服务', async () => {
    const read = {} as GuestbookReadService
    const batch = {} as AdminGuestbookBatchService
    const client = { browser: 'Safari 18', region: '北京' }
    const write = { clientContext: jest.fn().mockReturnValue(client), create: jest.fn().mockResolvedValue({ id: 42 }) }
    const guest = new GuestbookController(read, write as unknown as GuestbookWriteService)
    const owner = new AdminGuestbookController(read, write as unknown as GuestbookWriteService, batch)
    const { value } = request()

    await expect(guest.create(input, visitor, value)).resolves.toEqual({ id: 42 })
    expect(write.clientContext).toHaveBeenNthCalledWith(1, value)
    expect(write.create).toHaveBeenNthCalledWith(1, input, visitor, undefined, client)
    await expect(owner.create(input, { id: 'owner-1' }, value)).resolves.toEqual({ id: 42 })
    expect(write.clientContext).toHaveBeenNthCalledWith(2, value)
    expect(write.create).toHaveBeenNthCalledWith(2, input, '', 'owner-1', client)
  })
})
