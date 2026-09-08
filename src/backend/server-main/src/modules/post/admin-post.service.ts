/**
 * @file admin-post.service.ts
 * @description 文章草稿、发布、撤回和归档；归档不物理删除已有文章与评论
 */
import { FilterQuery, LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostAddress } from '../../entities/post-address.entity'
import { lockTaxonomy } from './taxonomy-lock'
import { QueryAdminPostsDto, SavePostDto } from './dto/save-post.dto'
import { parsePostMarkdown } from './post-markdown'
import { PostRevisionsService } from './post-revisions.service'
import { postSnapshot } from './post-snapshot'
import { canonicalTaxonomyLabel } from './taxonomy-aliases'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'

@Injectable()
export class AdminPostService {
  constructor(
    private readonly em: EntityManager,
    private readonly revisions: PostRevisionsService,
  ) {}

  async list(query: QueryAdminPostsDto) {
    const where: FilterQuery<Post> = { deletedAt: query.status === 'trash' ? { $ne: null } : null }
    if (query.status && query.status !== 'trash') where.status = query.status
    if (query.search) where.title = { $ilike: `%${query.search}%` }
    if (query.category) where.category = query.category
    if (query.folder) where.folder = query.folder
    if (query.tag) where.tags = { label: query.tag }
    const [items, total] = await this.em.findAndCount(Post, where, {
      fields: [
        'id',
        'revision',
        'deletedAt',
        'title',
        'status',
        'updatedAt',
        'publishedAt',
        'commentCount',
        'category',
        'folder',
        'pinned',
        'tags.label',
      ],
      populate: ['tags'],
      orderBy: { [query.sort]: query.order, id: query.order },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })
    return {
      items: items.map((post) => ({
        id: post.id,
        revision: post.revision,
        deleted: !!post.deletedAt,
        title: post.title,
        status: post.status,
        updatedAt: post.updatedAt.toISOString(),
        publishedAt: post.publishedAt.toISOString(),
        comments: post.commentCount,
        category: post.category,
        folder: post.folder,
        pinned: post.pinned,
        tags: post.tags.getItems().map((tag) => tag.label),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async detail(id: number) {
    const post = await this.em.findOne(Post, { id }, { populate: ['tags'] })
    if (!post) throw new NotFoundException('文章不存在')
    return this.toEditor(post)
  }

  async filters() {
    const folders = await this.em.find(PostFolder, {}, { orderBy: { label: 'asc' } })
    const tags = await this.em.find(PostTag, {}, { fields: ['label'], orderBy: { label: 'asc' } })
    return { folders: folders.map((item) => item.label), tags: tags.map((tag) => tag.label) }
  }

  async restore(id: number, revision: number): Promise<{ ok: true }> {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const post = await em.findOne(Post, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!post) throw new NotFoundException('文章不存在')
      this.assertRevision(post, revision)
      await em.populate(post, ['tags'])
      await this.revisions.record(em, post, '历史版本')
      if (post.status !== 'archived' && !post.deletedAt) throw new BadRequestException('只能恢复已归档或回收的文章')
      post.deletedAt = undefined
      // 恢复为草稿，避免归档内容未经复核重新公开。
      post.status = 'draft'
      post.revision += 1
      post.updatedAt = new Date()
      await em.flush()
      await this.revisions.record(em, post, '恢复为草稿')
      await em.flush()
      return { ok: true }
    })
  }

  async save(id: number | null, input: SavePostDto, reason?: string) {
    if (input.cover && !/^https?:\/\//i.test(input.cover) && !/^\/(?!\/)/.test(input.cover)) {
      throw new BadRequestException('封面只允许 HTTP(S) 或站内路径')
    }
    if (input.status === 'published' && !input.contentRaw.trim()) throw new BadRequestException('发布文章必须填写正文')
    return this.em.transactional(async (em) => {
      const now = new Date()
      await lockTaxonomy(em)
      await lockMedia(em)
      input = {
        ...input,
        folder: await canonicalTaxonomyLabel(em, 'folders', input.folder),
        tags: [...new Set(await Promise.all(input.tags.map((tag) => canonicalTaxonomyLabel(em, 'tags', tag.trim()))))],
      }
      if (!(await em.findOne(PostFolder, { label: input.folder }))) em.create(PostFolder, { label: input.folder })
      let post: Post
      if (id !== null) {
        const existing = await em.findOne(Post, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
        if (!existing) throw new NotFoundException('文章不存在')
        if (existing.deletedAt) throw new ConflictException('文章已在回收站，请先恢复再编辑')
        await em.populate(existing, ['tags'])
        this.assertRevision(existing, input.revision)
        await this.revisions.record(em, existing, '历史版本')
        post = existing
      } else {
        post = em.create(Post, {
          title: input.title,
          summary: '',
          category: input.category,
          folder: input.folder,
          readTimeMinutes: input.readTimeMinutes,
          status: 'draft',
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
          views: 0,
          likes: 0,
          commentCount: 0,
          pinned: false,
        })
      }
      if (post.status !== 'published' && input.status === 'published') post.publishedAt = now
      const slug = input.slug ?? post.slug ?? ''
      const address = slug ? await em.findOne(PostAddress, { slug }) : null
      if (address && address.post.id !== post.id) throw new ConflictException('该文章地址已被其他文章使用或保留')
      Object.assign(post, {
        slug: slug || undefined,
        coverAlt: input.coverAlt ?? post.coverAlt,
        seoTitle: input.seoTitle ?? post.seoTitle,
        seoDescription: input.seoDescription ?? post.seoDescription,
        seoNoindex: input.seoNoindex ?? post.seoNoindex,
        title: input.title,
        summary: input.summary,
        cover: input.cover || undefined,
        category: input.category,
        folder: input.folder,
        contentRaw: input.contentRaw,
        contentSections: parsePostMarkdown(input.contentRaw),
        readTimeMinutes: input.readTimeMinutes,
        status: input.status,
        pinned: input.pinned,
        updatedAt: now,
      })
      const tags: PostTag[] = []
      for (const label of [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].sort()) {
        const existing = await em.findOne(PostTag, { label })
        tags.push(
          existing ??
            (await em.upsert(PostTag, { label, slug: label, color: 'sky', count: 0 }, { onConflictAction: 'ignore' })),
        )
      }
      post.tags.set(tags)
      post.revision += 1
      await em.flush()
      await synchronizeMediaReferences(
        em,
        `post:${post.id}`,
        'post',
        [post.cover, post.contentRaw, post.contentSections],
        { post },
      )
      if (slug && !address) em.create(PostAddress, { slug, post })
      await this.revisions.record(
        em,
        post,
        reason ??
          (input.status === 'published' ? '保存公开内容' : input.status === 'draft' ? '保存草稿' : '保存归档内容'),
      )
      await em.flush()
      return this.toEditor(post)
    })
  }

  async archive(id: number, revision: number): Promise<{ ok: true }> {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const post = await em.findOne(Post, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!post) throw new NotFoundException('文章不存在')
      if (post.deletedAt) throw new ConflictException('文章已在回收站，请先恢复')
      this.assertRevision(post, revision)
      await em.populate(post, ['tags'])
      await this.revisions.record(em, post, '历史版本')
      post.status = 'archived'
      post.revision += 1
      post.updatedAt = new Date()
      await em.flush()
      await this.revisions.record(em, post, '归档文章')
      await em.flush()
      return { ok: true }
    })
  }

  private toEditor(post: Post) {
    const snapshot = postSnapshot(post)
    delete snapshot.contentSections
    return {
      id: post.id,
      revision: post.revision,
      savedAt: post.updatedAt.toISOString(),
      deletedAt: post.deletedAt?.toISOString(),
      ...snapshot,
    }
  }
  async restoreRevision(id: number, historical: number, expected: number) {
    const revision = await this.revisions.detail(id, historical)
    return this.save(id, { ...revision.snapshot, revision: expected, status: 'draft' }, `恢复修订 ${historical}`)
  }

  private assertRevision(post: Post, expected: number | undefined) {
    if (expected === undefined)
      throw new HttpException('保存需要内容版本，请重新读取文章后合并修改', HttpStatus.PRECONDITION_REQUIRED)
    if (post.revision !== expected)
      throw new ConflictException('文章或关联目录已更新，已拒绝覆盖；请比较服务器版本并合并修改')
  }
}
