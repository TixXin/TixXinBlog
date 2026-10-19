/**
 * @file admin-taxonomy.service.ts
 * @description 专栏和标签的真实维护：更名同步引用、引用中禁止删除。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import type { PostTagColor } from '../../entities/post-tag.entity'
import { lockTaxonomy } from './taxonomy-lock'
import { LockMode } from '@mikro-orm/core'
import { PostRevisionsService } from './post-revisions.service'
import { TaxonomyAlias } from '../../entities/taxonomy-alias.entity'
import { registerTaxonomyRename } from './taxonomy-aliases'
import { lockMedia } from '../media/media-references'
import { msg, zh } from '../../common/i18n'

@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly em: EntityManager,
    private readonly revisions: PostRevisionsService,
  ) {}

  private kind(value: string): 'folders' | 'tags' {
    if (value !== 'folders' && value !== 'tags') throw new BadRequestException(msg('post.taxonomyUnsupported'))
    return value
  }

  async list() {
    const [folders, tags, categories] = await Promise.all([
      this.em
        .execute(`select f.id,f.label,count(p.id)::int as "total",count(p.id) filter(where p.status='published')::int as "published"
        from post_folder f left join post p on p.folder=f.label group by f.id order by f.label`),
      this.em
        .execute(`select t.id,t.label,t.color,count(p.id)::int as "total",count(p.id) filter(where p.status='published')::int as "published"
        from post_tag t left join post_tag_map m on m.post_tag_id=t.id left join post p on p.id=m.post_id group by t.id order by t.label`),
      this.em.execute(`select category, count(*)::int as total from post group by category`),
    ])
    return { folders, tags, categories }
  }

  async save(rawKind: string, id: number | null, input: { label: string; color?: PostTagColor }) {
    const kind = this.kind(rawKind)
    return this.em.transactional(async (em) => {
      await lockTaxonomy(em)
      await lockMedia(em)
      if (await em.findOne(TaxonomyAlias, { kind, alias: input.label }))
        throw new ConflictException(msg('post.taxonomyNameIsAlias'))
      if (kind === 'folders') {
        const current = id === null ? null : await em.findOne(PostFolder, { id })
        if (id !== null && !current) throw new NotFoundException(msg('post.folderNotFound'))
        const duplicate = await em.findOne(PostFolder, { label: input.label })
        if (duplicate && duplicate.id !== id) throw new ConflictException(msg('post.folderDuplicate'))
        if (current) {
          if (current.label !== input.label) {
            await registerTaxonomyRename(em, kind, current.label, input.label)
            const ids = await em.find(Post, { folder: current.label }, { fields: ['id'], orderBy: { id: 'asc' } })
            for (const item of ids) {
              const post = await em.findOneOrFail(
                Post,
                { id: item.id },
                { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
              )
              await em.populate(post, ['tags'])
              await this.revisions.record(em, post, zh('post.revisionReason.beforeFolderRename'))
              post.folder = input.label
              post.revision += 1
              post.updatedAt = new Date()
              await this.revisions.record(em, post, zh('post.revisionReason.folderRename'))
            }
          }
          current.label = input.label
        } else em.create(PostFolder, { label: input.label })
      } else {
        const current = id === null ? null : await em.findOne(PostTag, { id })
        if (id !== null && !current) throw new NotFoundException(msg('post.tagNotFound'))
        const duplicate = await em.findOne(PostTag, { $or: [{ label: input.label }, { slug: input.label }] })
        if (duplicate && duplicate.id !== id) throw new ConflictException(msg('post.tagDuplicate'))
        if (current) {
          if (current.label !== input.label) await registerTaxonomyRename(em, kind, current.label, input.label)
          const changed = current.label !== input.label || (input.color !== undefined && current.color !== input.color)
          const affected: Post[] = []
          if (changed) {
            const ids = await em.find(Post, { tags: current.id }, { fields: ['id'], orderBy: { id: 'asc' } })
            for (const item of ids) {
              const post = await em.findOneOrFail(
                Post,
                { id: item.id },
                { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
              )
              await em.populate(post, ['tags'])
              await this.revisions.record(em, post, zh('post.revisionReason.beforeTagChange'))
              affected.push(post)
            }
          }
          current.label = input.label
          current.slug = input.label
          if (input.color) current.color = input.color
          for (const post of affected) {
            post.revision += 1
            post.updatedAt = new Date()
            await this.revisions.record(em, post, zh('post.revisionReason.tagChange'))
          }
        } else em.create(PostTag, { label: input.label, slug: input.label, color: input.color ?? 'sky', count: 0 })
      }
      await em.flush()
      return { ok: true }
    })
  }

  async remove(rawKind: string, id: number) {
    const kind = this.kind(rawKind)
    return this.em.transactional(async (em) => {
      await lockTaxonomy(em)
      if (kind === 'folders') {
        const folder = await em.findOne(PostFolder, { id })
        if (!folder) throw new NotFoundException(msg('post.folderNotFound'))
        const total = await em.count(Post, { folder: folder.label })
        if (total) throw new ConflictException(msg('post.folderInUse', { total }))
        em.remove(folder)
      } else {
        const tag = await em.findOne(PostTag, { id })
        if (!tag) throw new NotFoundException(msg('post.tagNotFound'))
        const total = await em.count(Post, { tags: tag.id })
        if (total) throw new ConflictException(msg('post.tagInUse', { total }))
        em.remove(tag)
      }
      await em.flush()
      return { ok: true }
    })
  }
}
