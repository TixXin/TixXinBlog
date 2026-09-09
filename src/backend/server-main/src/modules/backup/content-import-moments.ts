/** @file content-import-moments.ts @description 在内容迁入事务中创建朋友圈草稿、映射文章并重建媒体引用，不迁入访客身份或点赞 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { ConflictException } from '@nestjs/common'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { Post } from '../../entities/post.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importMoments(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.moments ?? []) {
    const target = plan.moments.find((note) => note.sourceId === source.sourceId)!
    if (target.skip) continue
    const { linkedArticleId: sourcePostId, ...values } = source.values
    const postId = sourcePostId
      ? (result.posts.find((post) => post.sourceId === sourcePostId)?.id ?? target.linkedArticleId)
      : null
    if (sourcePostId && !postId) throw new ConflictException('动态引用文章未能映射，迁入已回滚')
    const note = em.create(Moment, {
      ...values,
      content: values.content!,
      status: 'draft',
      linkedArticle: postId ? em.getReference(Post, postId) : null,
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
      createdAt: new Date(source.createdAt),
    })
    await em.flush()
    await synchronizeMediaReferences(em, `moment:${note.id}`, 'moment', [note.content, note.images, note.linkedLink], {
      moment: note,
    })
    for (const comment of source.comments) {
      if (comment.deleted) continue
      const created = em.create(MomentComment, {
        moment: note,
        content: comment.content,
        author: comment.author,
        avatar: comment.avatar || '/avatar.svg',
        isOwner: comment.isOwner,
        status: comment.status,
        createdAt: new Date(comment.createdAt),
        visitorIdHash: createHash('sha256').update(randomUUID()).digest('hex'),
      })
      await em.flush()
      await synchronizeMediaReferences(em, `moment-comment:${created.id}`, 'moment-comment', [created.avatar], {
        moment: note,
        momentComment: created,
      })
      result.comments++
    }
    result.moments.push({ sourceId: source.sourceId, id: note.id })
  }
}
