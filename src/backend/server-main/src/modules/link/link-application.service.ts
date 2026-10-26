/** @file link-application.service.ts @description 友链申请的公开提交与博主审核；通过时在同一事务内建立带提交标识的友链草稿 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
import { FriendLink } from '../../entities/friend-link.entity'
import { FriendLinkApplication } from '../../entities/friend-link-application.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { recordOwnerEvent } from '../operations/owner-events'
import { submissionHash } from '../moment/moment-values'
import { linkUrl, linkValues } from './link-values'
import type { AdminLinkApplicationQuery, CreateLinkApplicationDto } from './link-application.dto'
import { LinkService } from './link.service'
import { msg } from '../../common/i18n'
type ApplicationInput = Omit<CreateLinkApplicationDto, 'website' | 'formElapsedMs' | 'formRenderedAt'>
@Injectable()
export class LinkApplicationService {
  constructor(
    private readonly em: EntityManager,
    private readonly links: LinkService,
  ) {}
  serialize(item: FriendLinkApplication) {
    return {
      id: item.id,
      name: item.name,
      url: item.url,
      domain: new URL(item.url).host,
      description: item.description,
      contact: item.contact ?? null,
      message: item.message,
      status: item.status,
      handledAt: item.handledAt?.toISOString() ?? null,
      createdLinkId: item.createdLinkId ?? null,
      createdAt: item.createdAt.toISOString(),
    }
  }
  async status() {
    const settings = await this.em.findOneOrFail(LinkSettings, { id: 'default' })
    return { applicationsEnabled: settings.applicationsEnabled }
  }
  async submit(input: ApplicationInput) {
    const url = linkUrl(input.url)
    try {
      return await this.em.transactional(async (em) => {
        const settings = await em.findOneOrFail(LinkSettings, { id: 'default' })
        if (!settings.applicationsEnabled) throw new NotFoundException(msg('link.applicationsClosed'))
        // 只提示已公开的同址友链，博主的草稿与下架记录不向访客暴露。
        if (await em.findOne(FriendLink, { url, status: 'published', deletedAt: null }))
          throw new ConflictException(msg('link.applicationListed'))
        if (await em.findOne(FriendLinkApplication, { url, status: 'pending' }))
          throw new ConflictException(msg('link.applicationPending'))
        const application = em.create(FriendLinkApplication, {
          id: randomUUID(),
          name: input.name,
          url,
          description: input.description ?? '',
          contact: input.contact || null,
          message: input.message ?? '',
        })
        await em.flush()
        await recordOwnerEvent(em, 'link-application', application.id, 'pending_review')
        return { requestId: application.id }
      })
    } catch (error) {
      // 并发提交同一地址时由待审唯一索引兜底，与先行检查返回同一提示。
      if (error instanceof UniqueConstraintViolationException)
        throw new ConflictException(msg('link.applicationPending'))
      throw error
    }
  }
  async list(query: AdminLinkApplicationQuery) {
    const where: FilterQuery<FriendLinkApplication> = {}
    if (query.status === 'handled') where.status = { $in: ['approved', 'rejected'] }
    else if (query.status && query.status !== 'all') where.status = query.status
    const [items, total] = await this.em.findAndCount(FriendLinkApplication, where, {
      orderBy: { createdAt: 'DESC', id: 'DESC' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    const pendingTotal = await this.em.count(FriendLinkApplication, { status: 'pending' })
    return {
      items: items.map((item) => this.serialize(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pendingTotal,
    }
  }
  async detail(id: string) {
    const item = await this.em.findOne(FriendLinkApplication, { id })
    if (!item) throw new NotFoundException(msg('link.applicationNotFound'))
    return this.serialize(item)
  }
  async approve(id: string) {
    const linkId = await this.em.transactional(async (em) => {
      const item = await em.findOne(FriendLinkApplication, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException(msg('link.applicationNotFound'))
      // 重复确认直接返回已建立的草稿，网络重试不会生成第二条友链。
      if (item.status === 'approved' && item.createdLinkId) return item.createdLinkId
      if (item.status !== 'pending') throw new ConflictException(msg('link.applicationHandled'))
      const duplicate = await em.findOne(FriendLink, { url: item.url, deletedAt: null })
      if (duplicate) throw new BadRequestException(msg('link.urlExists', { id: duplicate.id }))
      const values = linkValues({ name: item.name, url: item.url, description: item.description })
      const link = em.create(FriendLink, {
        name: item.name,
        url: item.url,
        description: item.description,
        requestId: item.id,
        requestHash: submissionHash(values),
      })
      await em.flush()
      item.status = 'approved'
      item.handledAt = new Date()
      item.createdLinkId = link.id
      await em.flush()
      return link.id
    })
    return { application: await this.detail(id), link: await this.links.detail(linkId, true) }
  }
  async reject(id: string) {
    await this.em.transactional(async (em) => {
      const item = await em.findOne(FriendLinkApplication, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException(msg('link.applicationNotFound'))
      if (item.status === 'rejected') return
      if (item.status !== 'pending') throw new ConflictException(msg('link.applicationHandled'))
      item.status = 'rejected'
      item.handledAt = new Date()
      await em.flush()
    })
    return { application: await this.detail(id) }
  }
}
