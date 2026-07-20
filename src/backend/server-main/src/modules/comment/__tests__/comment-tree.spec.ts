/**
 * @file comment-tree.spec.ts
 * @description buildCommentTree 纯函数单元测试
 * @author TixXin
 * @since 2026-07-20
 */

import { buildCommentTree, CommentRow } from '../comment-tree'

function row(id: number, parentId: number | null, minute: number): CommentRow {
  return {
    id,
    parentId,
    authorName: `用户${id}`,
    authorAvatar: '/avatar.svg',
    content: `评论 ${id}`,
    likes: 0,
    isOwner: false,
    createdAt: new Date(Date.UTC(2026, 6, 20, 10, minute)),
  }
}

describe('buildCommentTree', () => {
  it('空输入返回空数组', () => {
    expect(buildCommentTree([])).toEqual([])
  })

  it('三层嵌套正确挂载且保持时间顺序', () => {
    const rows = [row(1, null, 0), row(2, 1, 1), row(3, 2, 2), row(4, null, 3), row(5, 1, 4)]
    const tree = buildCommentTree(rows)

    expect(tree.map((n) => n.id)).toEqual([1, 4])
    expect(tree[0]!.replies.map((n) => n.id)).toEqual([2, 5])
    expect(tree[0]!.replies[0]!.replies.map((n) => n.id)).toEqual([3])
    expect(tree[0]!.time).toBe('2026-07-20T10:00:00.000Z')
  })

  it('父节点缺失的行按根评论兜底,不丢数据', () => {
    const tree = buildCommentTree([row(9, 999, 0)])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe(9)
  })

  it('字段映射对齐前端 CommentItem', () => {
    const [node] = buildCommentTree([row(1, null, 0)])
    expect(node).toMatchObject({ author: '用户1', avatar: '/avatar.svg', content: '评论 1', likes: 0, isOwner: false })
  })
})
