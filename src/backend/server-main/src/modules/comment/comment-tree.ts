/**
 * @file comment-tree.ts
 * @description 纯函数:把平铺的评论行组装成前端 CommentItem 树(字段对齐 features/post/types.ts)
 * @author TixXin
 * @since 2026-07-20
 */

/** 组装输入的最小行结构(与 Comment 实体解耦,便于测试) */
export interface CommentRow {
  id: number
  parentId: number | null
  authorName: string
  authorAvatar: string
  content: string
  likes: number
  isOwner: boolean
  createdAt: Date
}

/** 前端 CommentItem 形状(api.md §7.2) */
export interface CommentTreeNode {
  id: number
  author: string
  avatar: string
  content: string
  time: string
  likes: number
  isOwner: boolean
  replies: CommentTreeNode[]
}

/** 行按 createdAt 升序排列时,输出根评论与嵌套回复均保持时间顺序 */
export function buildCommentTree(rows: CommentRow[]): CommentTreeNode[] {
  const nodes = new Map<number, CommentTreeNode>()
  const roots: CommentTreeNode[] = []

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      author: row.authorName,
      avatar: row.authorAvatar,
      content: row.content,
      time: row.createdAt.toISOString(),
      likes: row.likes,
      isOwner: row.isOwner,
      replies: [],
    })
  }

  for (const row of rows) {
    const node = nodes.get(row.id)
    if (!node) continue
    const parent = row.parentId === null ? undefined : nodes.get(row.parentId)
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }

  return roots
}
