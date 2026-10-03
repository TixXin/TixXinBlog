/** @file prompts.service.ts @description 真实提示词查询与事务保存，保留幂等提交、并发编辑及媒体引用保护 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { ImagePrompt } from '../../entities/image-prompt.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { promptId, promptValues, promptWhere } from './prompts-values'
import type { AdminPromptQuery, PromptQuery, SavePromptDto } from './prompts.dto'

@Injectable()
export class PromptsService {
  constructor(private readonly em: EntityManager) {}

  serialize(item: ImagePrompt, admin = false) {
    const result = {
      id: item.id,
      title: item.title,
      description: item.description,
      prompt: item.prompt,
      negativePrompt: item.negativePrompt,
      model: item.model,
      tags: item.tags,
      imageUrl: item.media ? mediaUrl(item.media.id) : item.externalImageUrl!,
      imageAlt: item.imageAlt,
      width: item.media?.width ?? null,
      height: item.media?.height ?? null,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt?.toISOString() ?? null,
    }
    return admin
      ? {
          ...result,
          mediaId: item.media?.id ?? null,
          externalImageUrl: item.externalImageUrl ?? null,
          status: item.status,
          revision: item.revision,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }
      : result
  }

  async list(query: PromptQuery | AdminPromptQuery, admin = false) {
    const [items, total] = await this.em.findAndCount(ImagePrompt, promptWhere(query, admin), {
      populate: ['media'],
      orderBy: { id: 'DESC' },
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
    promptId(id)
    const item = await this.em.findOne(ImagePrompt, admin ? { id } : { id, status: 'published' }, {
      populate: ['media'],
    })
    if (!item) throw new NotFoundException('提示词不存在或尚未公开')
    return this.serialize(item, admin)
  }

  async submission(requestId: string) {
    const item = await this.em.findOne(ImagePrompt, { requestId }, { populate: ['media'] })
    if (!item) throw new NotFoundException('尚未找到此提交，请使用原提交标识重试')
    return { state: 'saved', item: this.serialize(item, true) }
  }

  async metadata() {
    // 一条查询使用同一可见快照，筛选项与计数只来自真实已发布内容。
    const [result] = await this.em.execute<
      {
        stats: { prompts: number; models: number; tags: number }
        models: { label: string; count: number }[]
        tags: { label: string; count: number }[]
      }[]
    >(`with public_prompts as (select id,model,tags from image_prompt where status='published'),
      tags as (select min(tag) as label,count(distinct p.id)::int as count from public_prompts p
        cross join lateral jsonb_array_elements_text(p.tags) tag group by lower(tag)),
      models as (select min(model) as label,count(*)::int as count from public_prompts where model<>'' group by lower(model))
      select jsonb_build_object('prompts',(select count(*)::int from public_prompts),'models',(select count(*)::int from models),'tags',(select count(*)::int from tags)) as stats,
        coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,label) from models),'[]'::jsonb) as models,
        coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count) order by count desc,label) from tags),'[]'::jsonb) as tags`)
    return result
  }

  async save(id: number | null, input: SavePromptDto) {
    if (id !== null) promptId(id)
    if (id === null && (!input.title || !input.prompt || !input.requestId || input.revision !== undefined))
      throw new BadRequestException('创建需要标题、提示词和唯一提交标识，不能携带编辑版本')
    if (id !== null && (input.revision === undefined || input.requestId !== undefined))
      throw new BadRequestException('编辑需要当前版本，不能携带创建标识')
    const values = promptValues(input)
    const hash = submissionHash(values)
    const savedId = await this.em.transactional(async (em) => {
      await lockMedia(em)
      if (id === null) {
        const prior = await em.findOne(ImagePrompt, { requestId: input.requestId })
        if (prior) {
          if (prior.requestHash !== hash) throw new ConflictException('此提交已处理，请核查原提示词')
          return prior.id
        }
      }
      const { mediaId, ...fields } = values
      const media = mediaId ? await em.findOne(MediaAsset, { id: mediaId, deletedAt: null }) : null
      if (mediaId && (!media || !media.mimeType.startsWith('image/') || media.width < 1 || media.height < 1))
        throw new BadRequestException('请选择有效的媒体库图片')
      const item =
        id !== null
          ? await em.findOne(ImagePrompt, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
          : em.create(ImagePrompt, {
              title: input.title!,
              prompt: input.prompt!,
              requestId: input.requestId,
              requestHash: hash,
            })
      if (!item) throw new NotFoundException('提示词不存在')
      if (id !== null && item.revision !== input.revision)
        throw new ConflictException('提示词已被修改，请保留输入并重新读取')
      Object.assign(item, fields)
      if (mediaId !== undefined) item.media = media
      if (Boolean(item.media) === Boolean(item.externalImageUrl))
        throw new BadRequestException('必须恰好选择一种图片来源；切换时请明确清空另一来源')
      if (item.status === 'published' && !item.publishedAt) item.publishedAt = new Date()
      if (id !== null) item.revision++
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `image-prompt:${item.id}`,
        'image-prompt',
        item.media ? [mediaUrl(item.media.id)] : [],
        { imagePrompt: item },
      )
      await em.flush()
      return item.id
    })
    return this.detail(savedId, true)
  }
}
