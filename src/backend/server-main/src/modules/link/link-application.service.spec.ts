/** @file link-application.service.spec.ts @description 友链申请提交开关、去重、通知幂等与审核建草稿的隔离单元测试 */
import 'reflect-metadata'
import { LockMode } from '@mikro-orm/core'
import { UniqueConstraintViolationException } from '@mikro-orm/postgresql'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FriendLink } from '../../entities/friend-link.entity'
import { FriendLinkApplication } from '../../entities/friend-link-application.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { recordOwnerEvent } from '../operations/owner-events'
import { submissionHash } from '../moment/moment-values'
import { AdminLinkApplicationQuery } from './link-application.dto'
import { LinkApplicationService } from './link-application.service'
import { linkValues } from './link-values'
import type { LinkService } from './link.service'

jest.mock('../operations/owner-events', () => ({ recordOwnerEvent: jest.fn().mockResolvedValue(undefined) }))

const applicationId = '0b6f6c1e-4f0a-4d55-9a4e-2f1d0c3b9a77'
const createdAt = new Date('2026-10-20T08:00:00.000Z')
const input = {
  name: '松下问童子',
  url: 'https://pine.example.org/blog',
  description: '前端工程与读书笔记',
  contact: 'hi@pine.example.org',
  message: '常读贵站的部署笔记，希望能互换友链。',
}

function fixture(
  options: { enabled?: boolean; published?: FriendLink | null; pending?: FriendLinkApplication | null } = {},
) {
  const settings = Object.assign(new LinkSettings(), {
    id: 'default',
    rules: [],
    applicationsEnabled: options.enabled ?? true,
  })
  const application = Object.assign(new FriendLinkApplication(), {
    id: applicationId,
    ...input,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
  })
  let created: FriendLink | null = null
  const tx = {
    findOneOrFail: jest.fn().mockResolvedValue(settings),
    findOne: jest.fn().mockImplementation((entity: unknown, where: Record<string, unknown>) => {
      if (entity === FriendLink)
        return Promise.resolve(where.status === 'published' ? (options.published ?? null) : null)
      if (where.status === 'pending') return Promise.resolve(options.pending ?? null)
      return Promise.resolve(application)
    }),
    create: jest.fn().mockImplementation((entity: unknown, values: Record<string, unknown>) => {
      if (entity === FriendLink) {
        created = Object.assign(new FriendLink(), values, { id: 58 })
        return created
      }
      return Object.assign(new FriendLinkApplication(), values)
    }),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  const em = {
    findOneOrFail: jest.fn().mockResolvedValue(settings),
    findOne: jest.fn().mockResolvedValue(application),
    findAndCount: jest.fn().mockResolvedValue([[application], 1]),
    count: jest.fn().mockResolvedValue(4),
    transactional: jest
      .fn()
      .mockImplementation((run: (manager: EntityManager) => Promise<unknown>) => run(tx as unknown as EntityManager)),
  }
  const links = { detail: jest.fn().mockResolvedValue({ id: 58, status: 'draft' }) }
  const service = new LinkApplicationService(em as unknown as EntityManager, links as unknown as LinkService)
  return { settings, application, tx, em, links, service, created: () => created }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('友链申请公开提交', () => {
  it('开关关闭时拒绝提交，不写入申请或通知', async () => {
    const { service, tx } = fixture({ enabled: false })
    await expect(service.submit(input)).rejects.toMatchObject({ status: 404 })
    expect(tx.create).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('状态接口只返回开关', async () => {
    const { service } = fixture({ enabled: false })
    await expect(service.status()).resolves.toEqual({ applicationsEnabled: false })
  })

  it('规范化地址后保存申请，并以申请编号写入博主通知', async () => {
    const { service, tx } = fixture()
    const result = await service.submit({ ...input, url: ' https://PINE.example.org/blog ' })
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(tx.create).toHaveBeenCalledWith(
      FriendLinkApplication,
      expect.objectContaining({ id: result.requestId, url: 'https://pine.example.org/blog', contact: input.contact }),
    )
    expect(recordOwnerEvent).toHaveBeenCalledWith(tx, 'link-application', result.requestId, 'pending_review')
  })

  it('空联系方式存为空值，简介与附言缺省为空串', async () => {
    const { service, tx } = fixture()
    await service.submit({ name: input.name, url: input.url, contact: '' })
    expect(tx.create).toHaveBeenCalledWith(
      FriendLinkApplication,
      expect.objectContaining({ contact: null, description: '', message: '' }),
    )
  })

  it('拒绝非 HTTP(S) 地址且不访问该地址', async () => {
    const { service, em } = fixture()
    await expect(service.submit({ ...input, url: 'ftp://pine.example.org' })).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('已公开的同址友链与待审同址申请均返回冲突', async () => {
    const listed = fixture({ published: Object.assign(new FriendLink(), { id: 3 }) })
    await expect(listed.service.submit(input)).rejects.toMatchObject({ status: 409 })
    const pending = fixture({ pending: Object.assign(new FriendLinkApplication(), { id: 'other' }) })
    await expect(pending.service.submit(input)).rejects.toMatchObject({ status: 409 })
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('并发提交触发待审唯一索引时转为同一冲突提示', async () => {
    const { service, em } = fixture()
    em.transactional.mockRejectedValueOnce(new UniqueConstraintViolationException(new Error('duplicate')))
    await expect(service.submit(input)).rejects.toMatchObject({ status: 409 })
  })
})

describe('友链申请审核', () => {
  it('列表按状态筛选并附带待审总数', async () => {
    const { service, em } = fixture()
    const result = await service.list(Object.assign(new AdminLinkApplicationQuery(), { status: 'handled', page: 2 }))
    expect(em.findAndCount).toHaveBeenCalledWith(
      FriendLinkApplication,
      { status: { $in: ['approved', 'rejected'] } },
      { orderBy: { createdAt: 'DESC', id: 'DESC' }, limit: 20, offset: 20 },
    )
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 20, pendingTotal: 4 })
    expect(result.items[0]).toMatchObject({ id: applicationId, domain: 'pine.example.org', contact: input.contact })
  })

  it('通过时锁定申请，建立带提交标识与摘要的友链草稿并回写编号', async () => {
    const { service, tx, application, links, created } = fixture()
    const result = await service.approve(applicationId)
    expect(tx.findOne).toHaveBeenCalledWith(
      FriendLinkApplication,
      { id: applicationId },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    const values = linkValues({ name: input.name, url: input.url, description: input.description })
    expect(tx.create).toHaveBeenCalledWith(FriendLink, {
      name: input.name,
      url: input.url,
      description: input.description,
      requestId: applicationId,
      requestHash: submissionHash(values),
    })
    expect(created()?.status).toBe('draft')
    expect(application).toMatchObject({ status: 'approved', createdLinkId: 58 })
    expect(application.handledAt).toBeInstanceOf(Date)
    expect(links.detail).toHaveBeenCalledWith(58, true)
    expect(result.link).toEqual({ id: 58, status: 'draft' })
  })

  it('重复通过返回原草稿，不再建立友链', async () => {
    const { service, tx, application } = fixture()
    Object.assign(application, { status: 'approved', createdLinkId: 31 })
    await service.approve(applicationId)
    expect(tx.create).not.toHaveBeenCalled()
  })

  it('同址友链已存在时不通过，申请保持待审', async () => {
    const { service, tx, application } = fixture()
    tx.findOne.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === FriendLink ? Object.assign(new FriendLink(), { id: 9 }) : application),
    )
    await expect(service.approve(applicationId)).rejects.toMatchObject({ status: 400 })
    expect(application.status).toBe('pending')
    expect(tx.create).not.toHaveBeenCalled()
  })

  it('拒绝只改变状态；已通过的申请不能再拒绝，重复拒绝无副作用', async () => {
    const { service, tx, application } = fixture()
    await service.reject(applicationId)
    expect(application.status).toBe('rejected')
    expect(tx.flush).toHaveBeenCalledTimes(1)
    await service.reject(applicationId)
    expect(tx.flush).toHaveBeenCalledTimes(1)
    Object.assign(application, { status: 'approved', createdLinkId: 58 })
    await expect(service.reject(applicationId)).rejects.toMatchObject({ status: 409 })
    await expect(service.approve(applicationId)).resolves.toBeDefined()
  })

  it('已拒绝的申请不能通过', async () => {
    const { service, application } = fixture()
    application.status = 'rejected'
    await expect(service.approve(applicationId)).rejects.toMatchObject({ status: 409 })
  })

  it('不存在的申请返回 404', async () => {
    const { service, em, tx } = fixture()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.detail(applicationId)).rejects.toMatchObject({ status: 404 })
    tx.findOne.mockResolvedValueOnce(null)
    await expect(service.reject(applicationId)).rejects.toMatchObject({ status: 404 })
  })
})
