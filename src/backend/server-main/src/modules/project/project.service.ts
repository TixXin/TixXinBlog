/** @file project.service.ts @description 真实项目列表与管理事务，公开技术覆盖率来自实际标签明细 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode, raw } from '@mikro-orm/core'
import type { FilterQuery } from '@mikro-orm/core'
import { Project } from '../../entities/project.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { projectId, projectValues } from './project-values'
import type { AdminProjectQuery, ProjectQuery, SaveProjectDto } from './project.dto'
const publicProjects = { status: 'published', deletedAt: null } as const
const links = {
  source: { label: '源代码', icon: 'lucide:github' },
  demo: { label: '在线预览', icon: 'lucide:external-link' },
  docs: { label: '文档', icon: 'lucide:book-open' },
  download: { label: '下载', icon: 'lucide:download' },
}
@Injectable()
export class ProjectService {
  constructor(private readonly em: EntityManager) {}
  serialize(project: Project, admin = false) {
    const result = {
      id: project.id,
      title: project.title,
      description: project.description,
      cover: project.coverMedia ? mediaUrl(project.coverMedia.id) : null,
      width: project.coverMedia?.width ?? null,
      height: project.coverMedia?.height ?? null,
      progress: project.progress,
      tags: project.tags,
      links: project.links.map((link) => ({ ...link, ...links[link.kind] })),
      publishedAt: project.publishedAt?.toISOString() ?? null,
    }
    return admin
      ? {
          ...result,
          coverMediaId: project.coverMedia?.id ?? null,
          status: project.status,
          sortOrder: project.sortOrder,
          revision: project.revision,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        }
      : result
  }
  async list(query: ProjectQuery | AdminProjectQuery, admin = false) {
    const where: FilterQuery<Project> = admin ? { deletedAt: null } : { ...publicProjects }
    const status = (query as AdminProjectQuery).status
    if (admin && status && status !== 'all') where.status = status
    if (query.progress) where.progress = query.progress
    if (query.tag)
      where.$and = [
        {
          [raw(
            (alias) => `exists(select 1 from jsonb_array_elements(${alias}.tags) as tag where lower(tag->>'label')=?)`,
            [query.tag.toLowerCase()],
          )]: true,
        },
      ]
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      where.$or = [{ title: { $ilike: pattern } }, { description: { $ilike: pattern } }]
    }
    const [items, total] = await this.em.findAndCount(Project, where, {
      populate: ['coverMedia'],
      orderBy: { sortOrder: 'DESC', id: 'DESC' },
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
    projectId(id)
    const item = await this.em.findOne(Project, admin ? { id, deletedAt: null } : { id, ...publicProjects }, {
      populate: ['coverMedia'],
    })
    if (!item) throw new NotFoundException('项目不存在或尚未公开')
    return this.serialize(item, admin)
  }
  async submission(requestId: string) {
    const item = await this.em.findOne(Project, { requestId }, { populate: ['coverMedia'] })
    if (!item) throw new NotFoundException('尚未找到此提交，请使用原提交标识重试')
    return item.deletedAt ? { state: 'deleted', id: item.id } : { state: 'saved', item: this.serialize(item, true) }
  }
  async metadata() {
    // 同一查询快照统计总量与标签，避免并发发布时把旧分母和新标签计数混在一起。
    const [result] = await this.em.execute<
      {
        stats: { projects: number; active: number; dev: number; archived: number; tags: number }
        tags: { label: string; color: string; count: number; percent: number }[]
      }[]
    >(
      `with public_projects as (select * from project where status='published' and deleted_at is null),
      counts as (select count(*)::int as projects,count(*) filter(where progress='active')::int as active,
        count(*) filter(where progress='dev')::int as dev,count(*) filter(where progress='archived')::int as archived from public_projects),
      tags as (select min(tag->>'label') as label,min(tag->>'color') as color,count(distinct p.id)::int as count
        from public_projects p cross join lateral jsonb_array_elements(p.tags) tag group by lower(tag->>'label'))
      select jsonb_build_object('projects',c.projects,'active',c.active,'dev',c.dev,'archived',c.archived,'tags',(select count(*)::int from tags)) as stats,
        coalesce((select jsonb_agg(jsonb_build_object('label',t.label,'color',t.color,'count',t.count,'percent',round(t.count*100.0/nullif(c.projects,0))) order by t.count desc,t.label) from tags t),'[]'::jsonb) as tags from counts c`,
    )
    return result
  }
  async save(id: number | null, input: SaveProjectDto) {
    if (id !== null) projectId(id)
    if (id === null && (!input.title || !input.requestId || input.revision !== undefined))
      throw new BadRequestException('创建项目需要标题和唯一提交标识，不能携带编辑版本')
    if (id !== null && (input.revision === undefined || input.requestId !== undefined))
      throw new BadRequestException('编辑项目需要当前版本，不能携带创建标识')
    const values = projectValues(input),
      hash = submissionHash(values)
    const savedId = await this.em.transactional(async (em) => {
      await lockMedia(em)
      if (id === null) {
        const prior = await em.findOne(Project, { requestId: input.requestId })
        if (prior) {
          if (prior.deletedAt || prior.requestHash !== hash) throw new ConflictException('此提交已处理，请核查原项目')
          return prior.id
        }
      }
      const { coverMediaId, ...fields } = values
      const media = coverMediaId ? await em.findOne(MediaAsset, { id: coverMediaId, deletedAt: null }) : null
      if (coverMediaId && (!media || !media.mimeType.startsWith('image/') || media.width < 1 || media.height < 1))
        throw new BadRequestException('请选择有效的媒体库封面')
      const item =
        id !== null
          ? await em.findOne(Project, { id, deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE })
          : em.create(Project, { title: input.title!, requestId: input.requestId, requestHash: hash })
      if (!item) throw new NotFoundException('项目不存在或已删除')
      if (id !== null && item.revision !== input.revision)
        throw new ConflictException('项目已被修改，请保留输入并重新读取')
      Object.assign(item, fields)
      if (coverMediaId !== undefined) item.coverMedia = media
      if (item.status === 'published' && !item.publishedAt) item.publishedAt = new Date()
      if (id !== null) item.revision++
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `project:${item.id}`,
        'project',
        item.coverMedia ? [mediaUrl(item.coverMedia.id)] : [],
        { project: item },
      )
      await em.flush()
      return item.id
    })
    return this.detail(savedId, true)
  }
  async remove(id: number, revision: number) {
    projectId(id)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const item = await em.findOne(Project, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!item) throw new NotFoundException('项目不存在')
      if (item.deletedAt) return { ok: true }
      if (item.revision !== revision) throw new ConflictException('项目已变化，请重新读取后确认删除')
      item.deletedAt = new Date()
      item.revision++
      await em.nativeDelete(MediaReference, { project: item })
      await em.flush()
      return { ok: true }
    })
  }
}
