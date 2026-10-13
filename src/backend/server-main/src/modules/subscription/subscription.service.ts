/** @file subscription.service.ts @description 订阅真实读取、事务编辑、乐观版本与媒体引用保护 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import type { FilterQuery, QueryOrderMap } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
import { appendPriceHistory, statistics, todayDate } from '@tixxin/subscription-domain'
import { Subscription } from '../../entities/subscription.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { faviconDomain, subscriptionId, subscriptionValues, validateSubscriptionDates } from './subscription-values'
import { faviconUrl } from './subscription-favicon.service'
import type {
  AdminSubscriptionQuery,
  SaveSubscriptionDto,
  SubscriptionQuery,
  SubscriptionSortDto,
} from './subscription.dto'
const publicSubscriptions = { status: 'published', deletedAt: null } as const
@Injectable()
export class SubscriptionService {
  constructor(private readonly em: EntityManager) {}
  serialize(item: Subscription, admin = false) {
    const automaticIcon = item.faviconDomain ? faviconUrl(item.faviconDomain) : null
    const result = {
      id: item.id,
      name: item.name,
      description: item.description,
      url: item.url ?? null,
      platform: item.platform ?? null,
      category: item.category,
      currency: item.currency,
      amount: item.amount,
      billingCycle: item.billingCycle,
      startDate: item.startDate ?? null,
      nextBillingDate: item.nextBillingDate ?? null,
      subscriptionStatus: item.subscriptionStatus,
      iconUrl: item.iconMedia ? mediaUrl(item.iconMedia.id) : automaticIcon,
      faviconUrl: automaticIcon,
      priceHistory: item.priceHistory,
      publishedAt: item.publishedAt?.toISOString() ?? null,
    }
    return admin
      ? {
          ...result,
          iconMediaId: item.iconMedia?.id ?? null,
          notes: item.notes,
          status: item.status,
          sortOrder: item.sortOrder,
          revision: item.revision,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }
      : result
  }
  private where(query: SubscriptionQuery | AdminSubscriptionQuery, admin = false): FilterQuery<Subscription> {
    const where: FilterQuery<Subscription> = admin ? { deletedAt: null } : { ...publicSubscriptions }
    const status = (query as AdminSubscriptionQuery).status
    if (admin && status && status !== 'all') where.status = status
    if (query.category) where.category = query.category
    if (query.currency) where.currency = query.currency
    if (query.subscriptionStatus) where.subscriptionStatus = query.subscriptionStatus
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      where.$or = [
        { name: { $ilike: pattern } },
        { description: { $ilike: pattern } },
        { platform: { $ilike: pattern } },
      ]
    }
    return where
  }
  async list(query: SubscriptionQuery | AdminSubscriptionQuery, admin = false) {
    const orderBy: QueryOrderMap<Subscription> = query.sort?.startsWith('amount-')
      ? { currency: 'ASC', amount: query.sort === 'amount-asc' ? 'ASC' : 'DESC', id: 'DESC' }
      : query.sort === 'name'
        ? { name: 'ASC', id: 'DESC' }
        : { sortOrder: 'DESC', id: 'DESC' }
    const [items, total] = await this.em.findAndCount(Subscription, this.where(query, admin), {
      populate: ['iconMedia'],
      orderBy,
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
  async stats(query: SubscriptionQuery) {
    // 单次完整筛选读取，不以当前分页冒充统计全集。
    const items = await this.em.find(Subscription, this.where(query))
    return statistics(
      items.map((item) => ({
        ...item,
        startDate: item.startDate ?? null,
        nextBillingDate: item.nextBillingDate ?? null,
      })),
      todayDate(),
    )
  }
  async detail(id: number, admin = false) {
    subscriptionId(id)
    const item = await this.em.findOne(Subscription, admin ? { id, deletedAt: null } : { id, ...publicSubscriptions }, {
      populate: ['iconMedia'],
    })
    if (!item) throw new NotFoundException('订阅不存在或尚未公开')
    return this.serialize(item, admin)
  }
  async submission(requestId: string) {
    const item = await this.em.findOne(Subscription, { requestId }, { populate: ['iconMedia'] })
    if (!item) throw new NotFoundException('尚未找到此提交，请使用原提交标识重试')
    return item.deletedAt ? { state: 'deleted', id: item.id } : { state: 'saved', item: this.serialize(item, true) }
  }
  async save(id: number | null, input: SaveSubscriptionDto) {
    if (id !== null) subscriptionId(id)
    if (
      id === null &&
      (!input.name ||
        !input.requestId ||
        input.amount === undefined ||
        !input.currency ||
        !input.billingCycle ||
        input.revision !== undefined)
    )
      throw new BadRequestException('创建需要名称、金额、币种、周期及唯一提交标识，不能携带编辑版本')
    if (id !== null && (input.revision === undefined || input.requestId !== undefined))
      throw new BadRequestException('编辑需要当前版本，不能携带创建标识')
    const values = subscriptionValues(input)
    const hash = submissionHash({ ...values, priceChangeReason: input.priceChangeReason?.trim() || '' })
    const savedId = await this.em.transactional(async (em) => {
      // 与媒体删除和其他内容维护使用同一锁，亦串行化幂等创建检查。
      await lockMedia(em)
      if (id === null) {
        const prior = await em.findOne(Subscription, { requestId: input.requestId })
        if (prior) {
          if (prior.deletedAt || prior.requestHash !== hash) throw new ConflictException('此提交已处理，请核查原订阅')
          return prior.id
        }
      }
      const { iconMediaId, ...fields } = values
      const media = iconMediaId ? await em.findOne(MediaAsset, { id: iconMediaId, deletedAt: null }) : null
      if (iconMediaId && (!media || !media.mimeType.startsWith('image/') || media.width < 1 || media.height < 1))
        throw new BadRequestException('请选择有效的媒体库图标')
      const item =
        id === null
          ? em.create(Subscription, {
              name: input.name!,
              amount: input.amount!,
              currency: input.currency!,
              billingCycle: input.billingCycle!,
              requestId: input.requestId,
              requestHash: hash,
            })
          : await em.findOne(Subscription, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException('订阅不存在或已删除')
      if (id !== null && item.revision !== input.revision)
        throw new ConflictException('订阅已被修改，请保留输入并重新读取')
      validateSubscriptionDates({ ...item, ...fields })
      // 先计算历史再修改受管实体；时钟回拨或历史冲突不能留下部分内存变更。
      let history: Subscription['priceHistory']
      try {
        history = appendPriceHistory(
          item.priceHistory,
          { ...item, ...fields },
          {
            id: randomUUID(),
            recordedAt: new Date().toISOString(),
            reason: input.priceChangeReason?.trim() || undefined,
          },
        )
      } catch (error) {
        if (error instanceof RangeError)
          throw new ConflictException('价格历史与当前时间或价格不一致，请保留输入，核对服务器时钟与历史后重试')
        throw error
      }
      Object.assign(item, fields)
      item.priceHistory = history
      if (iconMediaId !== undefined) item.iconMedia = media
      if (fields.url !== undefined) {
        // 新官网总是替换旧域名；无效自动图标域名不影响业务记录保存。
        item.faviconDomain = null
        if (fields.url) {
          try {
            item.faviconDomain = faviconDomain(fields.url)
          } catch {
            /* 图标失败使用 Lucide。 */
          }
        }
      }
      if (item.status === 'published' && !item.publishedAt) item.publishedAt = new Date()
      if (id !== null) item.revision++
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `subscription:${item.id}`,
        'subscription',
        item.iconMedia ? [mediaUrl(item.iconMedia.id)] : [],
        { subscription: item },
      )
      await em.flush()
      return item.id
    })
    return this.detail(savedId, true)
  }
  async remove(id: number, revision: number) {
    subscriptionId(id)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const item = await em.findOne(Subscription, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException('订阅不存在')
      if (item.deletedAt) {
        if (revision !== item.revision && revision !== item.revision - 1)
          throw new ConflictException('订阅已变化，请重新读取')
        return { ok: true }
      }
      if (item.revision !== revision) throw new ConflictException('订阅已变化，请重新读取后确认删除')
      item.deletedAt = new Date()
      item.revision++
      await em.nativeDelete(MediaReference, { subscription: item })
      await em.flush()
      return { ok: true }
    })
  }
  async sort(input: SubscriptionSortDto) {
    const ids = input.items.map((item) => item.id)
    if (new Set(ids).size !== ids.length) throw new BadRequestException('排序条目不能重复')
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const items = await em.find(
        Subscription,
        { id: { $in: ids }, deletedAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'ASC' } },
      )
      if (items.length !== ids.length) throw new NotFoundException('部分订阅不存在或已删除')
      const revisions = new Map(input.items.map((item) => [item.id, item]))
      for (const item of items) {
        const next = revisions.get(item.id)!
        if (item.revision !== next.revision) throw new ConflictException('订阅已被修改，请重新读取后排序')
      }
      for (const item of items) {
        item.sortOrder = revisions.get(item.id)!.sortOrder
        item.revision++
      }
      await em.flush()
      return {
        ok: true,
        items: items.map((item) => ({ id: item.id, revision: item.revision, sortOrder: item.sortOrder })),
      }
    })
  }
}
