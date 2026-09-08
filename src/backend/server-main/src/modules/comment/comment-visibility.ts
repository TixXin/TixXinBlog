/**
 * @file comment-visibility.ts
 * @description 评论最多三级；只有自身及全部祖先已通过审核时才公开，统一读取与计数条件。
 */
import type { FilterQuery } from '@mikro-orm/core'
import type { Comment } from '../../entities/comment.entity'
export function visibleCommentWhere() {
  return {
    status: 'published',
    $or: [
      { parent: null },
      { parent: { status: 'published', $or: [{ parent: null }, { parent: { status: 'published', parent: null } }] } },
    ],
  } satisfies FilterQuery<Comment>
}
/** 别名仅来自本项目固定 SQL，不能传入请求参数。 */
export function visibleCommentSql(alias = 'c'): string {
  if (!/^[a-z][a-z0-9_]*$/.test(alias)) throw new Error('非法内部 SQL 别名')
  return `${alias}.status='published' and (${alias}.parent_id is null or exists(select 1 from comment visible_parent where visible_parent.id=${alias}.parent_id and visible_parent.status='published' and (visible_parent.parent_id is null or exists(select 1 from comment visible_root where visible_root.id=visible_parent.parent_id and visible_root.status='published' and visible_root.parent_id is null))))`
}
