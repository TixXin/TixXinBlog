/**
 * @file post-revisions.service.ts
 * @description 修订快照读写；写入调用方必须持有文章内容事务锁。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Post } from '../../entities/post.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { legacyMarkdown, postSnapshot } from './post-snapshot'
import { synchronizeMediaReferences } from '../media/media-references'
import { msg, translateStored, type ApiLocale } from '../../common/i18n'

/** 修订原因以中文存储，只在修订原因前缀下反查，避免与其他域的同名中文混用 */
const REVISION_REASON_SCOPE = 'post.revisionReason.'

@Injectable()
export class PostRevisionsService {
  constructor(private readonly em: EntityManager) {}

  async record(em: EntityManager, post: Post, reason: string) {
    if (await em.findOne(PostRevision, { post: post.id, revision: post.revision })) return
    em.create(PostRevision, {
      post,
      revision: post.revision,
      snapshot: postSnapshot(post),
      reason,
      createdAt: new Date(),
    })
    await synchronizeMediaReferences(
      em,
      `revision:${post.id}:${post.revision}`,
      'revision',
      [post.cover, post.contentRaw, post.contentSections],
      { post, revision: post.revision },
    )
  }
  async list(postId: number, page: number, locale: ApiLocale = 'zh-CN') {
    if (!(await this.em.findOne(Post, { id: postId }, { fields: ['id'] })))
      throw new NotFoundException(msg('post.notFound'))
    const [items, total] = await this.em.findAndCount(
      PostRevision,
      { post: postId },
      {
        fields: ['id', 'revision', 'reason', 'createdAt'],
        orderBy: { revision: 'desc' },
        limit: 20,
        offset: (page - 1) * 20,
      },
    )
    return {
      items: items.map((item) => ({
        revision: item.revision,
        reason: translateStored(locale, item.reason, REVISION_REASON_SCOPE),
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: 20,
    }
  }
  async detail(postId: number, revision: number, locale: ApiLocale = 'zh-CN') {
    const item = await this.em.findOne(PostRevision, { post: postId, revision })
    if (!item) throw new NotFoundException(msg('post.revisionNotFound'))
    return {
      revision: item.revision,
      reason: translateStored(locale, item.reason, REVISION_REASON_SCOPE),
      createdAt: item.createdAt.toISOString(),
      snapshot: {
        ...item.snapshot,
        relatedContent: item.snapshot.relatedContent ?? [],
        contentRaw: item.snapshot.contentRaw || legacyMarkdown(item.snapshot.contentSections),
      },
    }
  }
}
