/** @file link.service.ts @description 友链公开投影、规则与博主维护，稳定分页和地址冲突均以数据库为准 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import { FriendLink } from '../../entities/friend-link.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { linkId, linkValues } from './link-values'
import type { AdminLinkQuery, LinkQuery, SaveLinkDto, SaveLinkSettingsDto } from './link.dto'
const publicLinks = { status: 'published', deletedAt: null } as const
@Injectable()
export class LinkService {
  constructor(private readonly em: EntityManager) {}
  serialize(link: FriendLink, admin = false) {
    const result = {
      id: link.id,
      name: link.name,
      description: link.description,
      url: link.url,
      domain: new URL(link.url).host,
      avatar: link.logoMedia ? mediaUrl(link.logoMedia.id) : (link.logoUrl ?? null),
      width: link.logoMedia?.width ?? null,
      height: link.logoMedia?.height ?? null,
      isFeatured: link.isFeatured,
      publishedAt: link.publishedAt?.toISOString() ?? null,
    }
    return admin
      ? {
          ...result,
          logoMediaId: link.logoMedia?.id ?? null,
          logoUrl: link.logoUrl ?? null,
          status: link.status,
          sortOrder: link.sortOrder,
          revision: link.revision,
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString(),
        }
      : result
  }
  async list(query: LinkQuery | AdminLinkQuery, admin = false) {
    const where: FilterQuery<FriendLink> = admin ? { deletedAt: null } : { ...publicLinks }
    const status = (query as AdminLinkQuery).status
    if (admin && status && status !== 'all') where.status = status
    if (query.featured !== undefined) where.isFeatured = query.featured === 'true'
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      where.$or = [{ name: { $ilike: pattern } }, { description: { $ilike: pattern } }, { url: { $ilike: pattern } }]
    }
    const [items, total] = await this.em.findAndCount(FriendLink, where, {
      populate: ['logoMedia'],
      orderBy: { isFeatured: 'DESC', sortOrder: 'DESC', id: 'DESC' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return {
      items: items.map((item) => this.serialize(item, admin)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async detail(id: number, admin = false) {
    linkId(id)
    const link = await this.em.findOne(
      FriendLink,
      { id, ...(admin ? { deletedAt: null } : publicLinks) },
      { populate: ['logoMedia'] },
    )
    if (!link) throw new NotFoundException('友链不存在或暂未公开')
    return this.serialize(link, admin)
  }
  async submission(requestId: string) {
    const link = await this.em.findOne(FriendLink, { requestId }, { populate: ['logoMedia'] })
    if (!link) throw new NotFoundException('尚未找到此提交')
    return link.deletedAt ? { state: 'deleted', id: link.id } : { state: 'saved', item: this.serialize(link, true) }
  }
  async metadata() {
    const [stats] = await this.em.execute<{ links: number; featured: number; domains: number }[]>(
      `select count(*)::int as links, count(*) filter(where is_featured)::int as featured,
        count(distinct substring(url from '^https?://([^/]+)'))::int as domains
        from friend_link where status='published' and deleted_at is null`,
    )
    const settings = await this.em.findOneOrFail(LinkSettings, { id: 'default' })
    return { stats, rules: settings.rules }
  }
  async settings() {
    const settings = await this.em.findOneOrFail(LinkSettings, { id: 'default' })
    return { rules: settings.rules, revision: settings.revision, updatedAt: settings.updatedAt.toISOString() }
  }
  async saveSettings(input: SaveLinkSettingsDto) {
    await this.em.transactional(async (em) => {
      await lockMedia(em)
      const settings = await em.findOneOrFail(LinkSettings, { id: 'default' }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (settings.revision !== input.revision) throw new ConflictException('友链规则已变化，请保留输入并重新读取')
      settings.rules = input.rules
      settings.revision++
      settings.updatedAt = new Date()
      await em.flush()
    })
    return this.settings()
  }
  async save(id: number | null, input: SaveLinkDto) {
    if (id !== null) linkId(id)
    if (id === null && (!input.name || !input.url || !input.requestId || input.revision !== undefined))
      throw new BadRequestException('创建友链需要名称、地址和唯一提交标识，不能携带编辑版本')
    if (id !== null && (input.revision === undefined || input.requestId !== undefined))
      throw new BadRequestException('编辑友链需要当前版本，不能携带创建标识')
    const values = linkValues(input),
      hash = submissionHash(values)
    const savedId = await this.em.transactional(async (em) => {
      await lockMedia(em)
      if (id === null) {
        const prior = await em.findOne(FriendLink, { requestId: input.requestId })
        if (prior) {
          if (prior.deletedAt || prior.requestHash !== hash) throw new ConflictException('此提交已处理，请核查原友链')
          return prior.id
        }
      }
      const { logoMediaId, ...fields } = values
      const current =
        id !== null
          ? await em.findOne(FriendLink, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
          : null
      if (id !== null && !current) throw new NotFoundException('友链不存在或已删除')
      if (current && current.revision !== input.revision)
        throw new ConflictException('友链已被修改，请保留输入并重新读取')
      const targetUrl = fields.url ?? current!.url
      // 普通创建及改址阻止重复；复制导入的同址草稿可继续编辑，但一次只允许公开一条。
      if (id === null || targetUrl !== current!.url) {
        const duplicate = await em.findOne(FriendLink, {
          url: targetUrl,
          deletedAt: null,
          ...(id === null ? {} : { id: { $ne: id } }),
        })
        if (duplicate) throw new BadRequestException(`该地址已存在于友链 #${duplicate.id}，请编辑已有友链或修改地址`)
      }
      if ((fields.status ?? current?.status) === 'published') {
        const published = await em.findOne(FriendLink, {
          url: targetUrl,
          ...publicLinks,
          ...(id === null ? {} : { id: { $ne: id } }),
        })
        if (published) throw new BadRequestException(`该地址的友链 #${published.id} 已公开，请修改地址或先下架原友链`)
      }
      const targetMediaId = logoMediaId === undefined ? current?.logoMedia?.id : logoMediaId
      const targetLogoUrl = fields.logoUrl === undefined ? current?.logoUrl : fields.logoUrl
      if (targetMediaId && targetLogoUrl)
        throw new BadRequestException('媒体库图片和外部头像只能选择一种，请清除另一项后保存')
      const media = targetMediaId ? await em.findOne(MediaAsset, { id: targetMediaId, deletedAt: null }) : null
      if (targetMediaId && (!media || !media.mimeType.startsWith('image/') || media.width < 1 || media.height < 1))
        throw new BadRequestException('请选择有效的媒体库头像')
      // 校验完成后才登记新实体，避免后续查询自动flush导致创建记录与自身重复。
      const item =
        current ??
        em.create(FriendLink, {
          name: input.name!,
          url: targetUrl,
          requestId: input.requestId,
          requestHash: hash,
        })
      Object.assign(item, fields)
      if (logoMediaId !== undefined) item.logoMedia = media
      if (item.status === 'published' && !item.publishedAt) item.publishedAt = new Date()
      if (id !== null) item.revision++
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `link:${item.id}`,
        'link',
        item.logoMedia ? [mediaUrl(item.logoMedia.id)] : [],
        { friendLink: item },
      )
      await em.flush()
      return item.id
    })
    return this.detail(savedId, true)
  }
  async remove(id: number, revision: number) {
    linkId(id)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const item = await em.findOne(FriendLink, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException('友链不存在')
      if (item.deletedAt) return { ok: true }
      if (item.revision !== revision) throw new ConflictException('友链已变化，请重新读取后确认删除')
      item.deletedAt = new Date()
      item.revision++
      await em.nativeDelete(MediaReference, { friendLink: item })
      await em.flush()
      return { ok: true }
    })
  }
}
