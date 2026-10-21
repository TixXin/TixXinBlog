/**
 * @file content-package-social.ts
 * @description 内容包中文章、闪念、朋友圈与留言等社交互动内容的校验与解析。
 */
import { SavePostDto } from '../post/dto/save-post.dto'
import { SaveFlashDto } from '../flash/admin-flash.controller'
import { SaveMomentDto } from '../moment/moment.dto'
import { momentUrl, momentValues } from '../moment/moment-values'
import { MOMENT_COMMENT_STATUSES } from '../../entities/moment-comment.entity'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'
import { FLASH_COMMENT_STATUSES } from '../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { COMMENT_STATUSES } from '../../entities/comment.entity'
import type { CommentStatus } from '../../entities/comment.entity'
import type { ContentRelation } from '../../common/types/content-relation'
import { array, boolean, date, dto, fail, number, packageImageUrl, record, text } from './content-package-helpers'
import type {
  PackageComment,
  PackageFlash,
  PackageGuestbook,
  PackageMoment,
  PackagePost,
} from './content-package.types'

export function parsePackagePosts(
  rawPosts: unknown,
  relations: (value: unknown, path: string, type: ContentRelation['type'], id: number) => ContentRelation[],
): { posts: PackagePost[]; commentsCount: number } {
  let commentsTotal = 0
  const posts = array(rawPosts, 'posts', 1000).map((value, index): PackagePost => {
    const path = `posts[${index}]`
    const item = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values', 'comments'])
    const values = dto(SavePostDto, item.values, `${path}.values`)
    values.relatedContent = relations(
      (item.values as Record<string, unknown>).relatedContent,
      `${path}.relatedContent`,
      'post',
      number(item.sourceId, `${path}.sourceId`),
    )
    if (
      'revision' in (item.values as object) ||
      (values.cover && !packageImageUrl(values.cover)) ||
      values.tags.some((tag) => !tag.trim())
    )
      fail(`${path}.values`)
    const comments = array(item.comments, `${path}.comments`, 10000).map((rowVal): PackageComment => {
      const row = record(rowVal, `${path}.comments`, [
        'sourceId',
        'parentId',
        'author',
        'avatar',
        'content',
        'isOwner',
        'status',
        'createdAt',
      ])
      const avatar = text(row.avatar, 'package.fieldCommentAvatar', 2048)
      if (!packageImageUrl(avatar) || !COMMENT_STATUSES.includes(row.status as CommentStatus))
        fail('package.fieldCommentStatusOrAvatar')
      return {
        sourceId: number(row.sourceId, 'package.fieldCommentId'),
        parentId: row.parentId === null ? null : number(row.parentId, 'package.fieldCommentParentId'),
        author: text(row.author, 'package.fieldCommentAuthor', 80, 1),
        avatar,
        content: text(row.content, 'package.fieldCommentContent', 1000, 1),
        isOwner: boolean(row.isOwner, 'package.fieldCommentIsOwner'),
        status: row.status as CommentStatus,
        createdAt: date(row.createdAt, 'package.fieldCommentCreatedAt'),
      }
    })
    commentsTotal += comments.length
    const map = new Map(comments.map((comment) => [comment.sourceId, comment]))
    if (map.size !== comments.length) fail('package.fieldCommentIdDuplicate')
    for (const comment of comments) {
      let cursor = comment
      let depth = 0
      while (cursor.parentId !== null) {
        const parent = map.get(cursor.parentId)
        if (!parent || ++depth > 2) fail('package.fieldCommentNesting')
        cursor = parent
      }
    }
    return {
      sourceId: number(item.sourceId, `${path}.sourceId`),
      createdAt: date(item.createdAt, `${path}.createdAt`),
      publishedAt: date(item.publishedAt, `${path}.publishedAt`),
      deleted: boolean(item.deleted, `${path}.deleted`),
      values,
      comments,
    }
  })
  if (new Set(posts.map((post) => post.sourceId)).size !== posts.length) fail('package.fieldPostIdDuplicate')
  return { posts, commentsCount: commentsTotal }
}

export function parsePackageFlashes(
  rawFlashes: unknown,
  version: number,
): { flashes: PackageFlash[]; commentsCount: number } {
  let commentsTotal = 0
  const flashes = array(rawFlashes, 'flashes', 2000).map((value, index): PackageFlash => {
    const row = record(value, `flashes[${index}]`, ['sourceId', 'createdAt', 'values', 'comments'])
    const values = dto(SaveFlashDto, row.values, 'package.fieldFlashValues')
    if (
      !values.content?.trim() ||
      (values.images ?? []).some((url) => !packageImageUrl(url)) ||
      (values.tags ?? []).some((tag) => !tag.trim())
    )
      fail('package.fieldFlashContent')
    // v13 才引入闪念评论审核状态：旧包按未知字段拒绝夹带，读取时一律视为已发布。
    const withStatus = version >= 13
    const comments = array(row.comments, 'package.fieldFlashComment', 10000).map((commentVal) => {
      const comment = record(commentVal, 'package.fieldFlashComment', [
        'author',
        'avatar',
        'content',
        'createdAt',
        ...(withStatus ? ['status'] : []),
      ])
      const avatar = text(comment.avatar, 'package.fieldFlashCommentAvatar', 2048)
      if (!packageImageUrl(avatar)) fail('package.fieldFlashCommentAvatar')
      if (withStatus && !FLASH_COMMENT_STATUSES.includes(comment.status as FlashCommentStatus))
        fail('package.fieldFlashCommentStatus')
      return {
        author: text(comment.author, 'package.fieldFlashCommentAuthor', 80, 1),
        avatar,
        content: text(comment.content, 'package.fieldFlashCommentContent', 1000, 1),
        status: withStatus ? (comment.status as FlashCommentStatus) : 'published',
        createdAt: date(comment.createdAt, 'package.fieldFlashCommentCreatedAt'),
      }
    })
    commentsTotal += comments.length
    return {
      sourceId: text(row.sourceId, 'package.fieldFlashId', 120, 1),
      createdAt: date(row.createdAt, 'package.fieldFlashCreatedAt'),
      values,
      comments,
    }
  })
  if (new Set(flashes.map((flash) => flash.sourceId)).size !== flashes.length)
    fail('package.fieldCommentsTotalOrFlashIdDuplicate')
  return { flashes, commentsCount: commentsTotal }
}

export function parsePackageMoments(
  rawMoments: unknown,
  version: number,
  posts: PackagePost[],
): { moments: PackageMoment[]; commentsCount: number } {
  let commentsTotal = 0
  const moments = array(version === 1 ? [] : rawMoments, 'moments', 2000).map((value, index): PackageMoment => {
    const path = `moments[${index}]`
    const row = record(value, path, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values', 'comments'])
    const rawValues = dto(SaveMomentDto, row.values, `${path}.values`)
    if ('requestId' in (row.values as object) || 'revision' in (row.values as object) || !rawValues.content?.trim())
      fail(`${path}.values`)
    const values = momentValues(rawValues)
    if (values.linkedArticleId && !posts.some((post) => post.sourceId === values.linkedArticleId))
      fail('package.fieldMomentArticleMissing')
    const comments = array(row.comments, `${path}.comments`, 10000).map(
      (commentVal): PackageMoment['comments'][number] => {
        const comment = record(commentVal, 'package.fieldMomentComment', [
          'sourceId',
          'author',
          'avatar',
          'content',
          'isOwner',
          'status',
          'deleted',
          'createdAt',
        ])
        if (!MOMENT_COMMENT_STATUSES.includes(comment.status as MomentCommentStatus))
          fail('package.fieldMomentCommentStatus')
        return {
          sourceId: text(comment.sourceId, 'package.fieldMomentCommentId', 120, 1),
          author: text(comment.author, 'package.fieldMomentCommentAuthor', 80, 1),
          avatar: momentUrl(text(comment.avatar, 'package.fieldMomentCommentAvatar', 2048), true, true),
          content: text(comment.content, 'package.fieldMomentCommentContent', 1000, 1),
          isOwner: boolean(comment.isOwner, 'package.fieldMomentCommentIsOwner'),
          status: comment.status as MomentCommentStatus,
          deleted: boolean(comment.deleted, 'package.fieldMomentCommentDeleted'),
          createdAt: date(comment.createdAt, 'package.fieldMomentCommentCreatedAt'),
        }
      },
    )
    if (new Set(comments.map((comment) => comment.sourceId)).size !== comments.length)
      fail('package.fieldMomentCommentIdDuplicate')
    commentsTotal += comments.length
    return {
      sourceId: text(row.sourceId, 'package.fieldMomentId', 120, 1),
      createdAt: date(row.createdAt, 'package.fieldMomentCreatedAt'),
      publishedAt: row.publishedAt === null ? null : date(row.publishedAt, 'package.fieldMomentPublishedAt'),
      deleted: boolean(row.deleted, 'package.fieldMomentDeleted'),
      values,
      comments,
    }
  })
  if (new Set(moments.map((note) => note.sourceId)).size !== moments.length) fail('package.fieldMomentIdDuplicate')
  return { moments, commentsCount: commentsTotal }
}

export function parsePackageGuestbook(rawGuestbook: unknown, version: number): PackageGuestbook[] {
  const guestbook = array(version >= 3 ? rawGuestbook : [], 'guestbook', 2000).map((value, index): PackageGuestbook => {
    const path = `guestbook[${index}]`
    const row = record(value, path, [
      'sourceId',
      'createdAt',
      'deleted',
      'author',
      'avatar',
      'content',
      'isOwner',
      'status',
      'isPinned',
      'replyToId',
      // v11 起可选携带提交时的浏览器与地区；旧版本出现即按未知字段拒绝。
      ...(version >= 11 ? ['browser', 'region'] : []),
    ])
    const avatar = text(row.avatar, `${path}.avatar`, 2048)
    if (!packageImageUrl(avatar) || !GUESTBOOK_STATUSES.includes(row.status as GuestbookStatus)) fail(path)
    return {
      sourceId: number(row.sourceId, `${path}.sourceId`),
      createdAt: date(row.createdAt, `${path}.createdAt`),
      deleted: boolean(row.deleted, `${path}.deleted`),
      author: text(row.author, `${path}.author`, 80, 1),
      avatar,
      content: text(row.content, `${path}.content`, 500, 1),
      isOwner: boolean(row.isOwner, `${path}.isOwner`),
      status: row.status as GuestbookStatus,
      isPinned: boolean(row.isPinned, `${path}.isPinned`),
      replyToId: row.replyToId === null ? null : number(row.replyToId, `${path}.replyToId`),
      ...(row.browser !== undefined ? { browser: text(row.browser, `${path}.browser`, 40) } : {}),
      ...(row.region !== undefined ? { region: text(row.region, `${path}.region`, 40) } : {}),
    }
  })
  const guestbookById = new Map(guestbook.map((message) => [message.sourceId, message]))
  if (guestbookById.size !== guestbook.length) fail('package.fieldGuestbookIdDuplicate')
  const checked = new Set<number>()
  for (const message of guestbook) {
    const path = new Set<number>()
    let id: number | null = message.sourceId
    while (id !== null && !checked.has(id)) {
      const current = guestbookById.get(id)
      if (!current || path.has(id)) fail('package.fieldGuestbookReplyLoop')
      path.add(id)
      id = current.replyToId
    }
    for (const cycleId of path) checked.add(cycleId)
  }
  return guestbook
}
