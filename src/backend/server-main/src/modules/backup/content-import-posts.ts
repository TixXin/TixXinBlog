/**
 * @file content-import-posts.ts
 * @description 迁入事务中的文章草稿及其评论层级写入与媒体引用同步。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { Comment } from '../../entities/comment.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { AdminPostService } from '../post/admin-post.service'
import { synchronizeMediaReferences } from '../media/media-references'
import { visibleCommentWhere } from '../comment/comment-visibility'
import { normalizedPost } from './content-import-plan'
import { zh } from '../../common/i18n'

export async function importPosts(
  em: EntityManager,
  posts: AdminPostService,
  current: ContentImportPlan,
  payload: ContentPackage,
  result: ContentImportResult,
): Promise<void> {
  for (const source of payload.posts) {
    const plan = current.posts.find((post) => post.sourceId === source.sourceId)!
    if (plan.skip) continue
    const saved = await posts.save(
      null,
      { ...(await normalizedPost(em, source.values)), relatedContent: [], slug: plan.slug, status: 'draft' },
      zh('post.revisionReason.import'),
    )
    const post = await em.findOneOrFail(Post, { id: saved.id })
    post.createdAt = new Date(source.createdAt)
    post.publishedAt = new Date(source.publishedAt)
    const map = new Map<number, Comment>()
    const sourceComments = new Map(source.comments.map((comment) => [comment.sourceId, comment]))
    const depth = (comment: (typeof source.comments)[number]) =>
      comment.parentId === null ? 0 : sourceComments.get(comment.parentId)?.parentId === null ? 1 : 2
    const ordered = [...source.comments].sort((a, b) => depth(a) - depth(b) || a.sourceId - b.sourceId)
    for (const comment of ordered) {
      const parent = comment.parentId === null ? undefined : map.get(comment.parentId)
      const created = em.create(Comment, {
        post,
        parent,
        depth: parent ? parent.depth + 1 : 0,
        authorSnapshot: { name: comment.author, avatar: comment.avatar || '/avatar.svg' },
        content: comment.content,
        isOwner: comment.isOwner,
        status: comment.status,
        likes: 0,
        createdAt: new Date(comment.createdAt),
      })
      map.set(comment.sourceId, created)
      result.comments += 1
    }
    await em.flush()
    for (const comment of map.values())
      await synchronizeMediaReferences(em, `comment:${comment.id}`, 'comment', [comment.authorSnapshot.avatar], {
        post,
        comment,
      })
    post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
    await em.flush()
    result.posts.push({ sourceId: source.sourceId, id: post.id })
  }
}
