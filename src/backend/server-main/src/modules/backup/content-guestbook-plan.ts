/** @file content-guestbook-plan.ts @description 用正文和完整引用语义匹配留言，重建编号时不把已删除父项映射到公开内容 */
import { ConflictException } from '@nestjs/common'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import { packageHash } from './content-package'
import type { PackageGuestbook } from './content-package'

export function guestbookHashes(messages: PackageGuestbook[]) {
  const byId = new Map(messages.map((message) => [message.sourceId, message]))
  const hashes = new Map<number, string>()
  for (const message of messages) {
    const path: PackageGuestbook[] = [],
      seen = new Set<number>()
    let id: number | null = message.sourceId
    while (id !== null && !hashes.has(id)) {
      const row = byId.get(id)
      if (!row || seen.has(id)) throw new ConflictException('留言引用不完整，不能生成导入预览')
      seen.add(id)
      path.push(row)
      id = row.replyToId
    }
    for (const row of path.reverse()) {
      hashes.set(
        row.sourceId,
        packageHash({
          author: row.author,
          avatar: row.avatar,
          content: row.content,
          isOwner: row.isOwner,
          deleted: row.deleted,
          parent: row.replyToId === null ? null : hashes.get(row.replyToId),
        }),
      )
    }
  }
  return hashes
}
export function guestbookImportPlan(
  current: PackageGuestbook[],
  input: PackageGuestbook[],
  strategy: 'skip' | 'copy',
): ContentImportPlan['guestbook'] {
  const existing = new Map<string, number>()
  for (const [id, hash] of guestbookHashes(current)) if (!existing.has(hash)) existing.set(hash, id)
  const hashes = guestbookHashes(input),
    incoming = new Map<string, number>()
  return input.map((source) => {
    const hash = hashes.get(source.sourceId)!,
      targetId = existing.get(hash),
      duplicateOf = incoming.get(hash)
    const skip = strategy === 'skip' && (targetId !== undefined || duplicateOf !== undefined)
    if (!skip) incoming.set(hash, source.sourceId)
    return {
      sourceId: source.sourceId,
      title: source.content.slice(0, 100),
      skip,
      ...(skip && targetId !== undefined ? { targetId } : skip ? { duplicateOf } : {}),
      reason: skip
        ? '跳过相同留言及引用语义，保留目标审核状态'
        : source.deleted
          ? '保留已删除记录以重建回复引用，不公开、不恢复媒体引用'
          : source.status === 'hidden'
            ? '迁入为隐藏留言，保留回复关系'
            : '迁入为待审留言，保留回复关系；不迁入置顶、访客凭据和回应',
    }
  })
}
