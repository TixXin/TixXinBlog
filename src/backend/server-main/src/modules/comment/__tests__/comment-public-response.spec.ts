/**
 * @file comment-public-response.spec.ts
 * @description 公开文章评论树白名单：完整嵌套回复不泄露访客身份、审核及版本字段。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Comment } from '../../../entities/comment.entity'
import { CommentLike } from '../../../entities/comment-like.entity'
import { Post } from '../../../entities/post.entity'
import { CommentService } from '../comment.service'

const createdAt = new Date('2026-03-01T00:00:00Z')
const privateIdentity = {
  visitorIdHash: 'private-visitor-hash',
  ip: '192.0.2.48',
  email: 'private@example.test',
}

function commentRow(id: number, parent?: { id: number }, isOwner = false) {
  return {
    ...privateIdentity,
    id,
    parent,
    post: { id: 7, revision: 9, contentRaw: '仅作为实体关系保留的正文' },
    status: 'published',
    revision: 4,
    moderatedAt: createdAt,
    depth: parent ? 1 : 0,
    authorSnapshot: { ...privateIdentity, name: isOwner ? '博主' : '访客', avatar: '/avatar.svg' },
    content: `第 ${id} 条评论`,
    likes: 3,
    isOwner,
    createdAt,
  }
}

function publicComment(id: number, isOwner = false, liked = false) {
  return {
    id,
    author: isOwner ? '博主' : '访客',
    avatar: '/avatar.svg',
    content: `第 ${id} 条评论`,
    time: createdAt.toISOString(),
    likes: 3,
    liked,
    isOwner,
    replies: [],
  }
}

describe('GET /posts/:id/comments 响应白名单', () => {
  it.each(['current-visitor', ''])('三级评论均只包含公开展示字段，当前访客：%s', async (visitor) => {
    const post = { id: 7, status: 'published', deletedAt: null, revision: 9, ...privateIdentity }
    const root = commentRow(11)
    const reply = commentRow(12, root, true)
    const leaf = { ...commentRow(13, reply), depth: 2 }
    const em = {
      findOne: jest.fn().mockResolvedValue(post),
      find: jest.fn(async (entity: unknown) => {
        if (entity === Comment) return [root, reply, leaf]
        if (entity === CommentLike) return [{ id: 90, comment: leaf, ...privateIdentity, createdAt }]
        throw new Error('未声明的实体查询')
      }),
    }
    const service = new CommentService(em as unknown as EntityManager)
    expect(JSON.parse(JSON.stringify(await service.getTree(7, visitor)))).toStrictEqual({
      total: 3,
      items: [
        {
          ...publicComment(11),
          replies: [{ ...publicComment(12, true), replies: [publicComment(13, false, !!visitor)] }],
        },
      ],
    })
    expect(em.findOne).toHaveBeenCalledWith(Post, { id: 7 }, { fields: ['id', 'status', 'deletedAt'] })
    // 公开树不能出现待审、隐藏、垃圾评论，也不能通过已发布子回复带出不可见祖先。
    expect(em.find).toHaveBeenCalledWith(
      Comment,
      {
        post,
        status: 'published',
        $or: [
          { parent: null },
          {
            parent: { status: 'published', $or: [{ parent: null }, { parent: { status: 'published', parent: null } }] },
          },
        ],
      },
      { orderBy: { createdAt: 'asc', id: 'asc' }, populate: ['parent'] },
    )
    if (visitor)
      expect(em.find).toHaveBeenCalledWith(CommentLike, {
        comment: { $in: [11, 12, 13] },
        visitorIdHash: visitor,
      })
    else expect(em.find).toHaveBeenCalledTimes(1)
  })

  it.each([
    null,
    { id: 7, status: 'draft', deletedAt: null },
    { id: 7, status: 'archived', deletedAt: null },
    { id: 7, status: 'published', deletedAt: createdAt },
  ])('不可见文章不返回评论或透露文章内部状态：%j', async (post) => {
    const em = { findOne: jest.fn().mockResolvedValue(post), find: jest.fn() }
    const service = new CommentService(em as unknown as EntityManager)
    await expect(service.getTree(7, 'current-visitor')).rejects.toMatchObject({ code: 1001, message: '文章不存在' })
    expect(em.find).not.toHaveBeenCalled()
  })
})
