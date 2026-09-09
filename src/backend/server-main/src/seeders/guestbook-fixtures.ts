/** @file guestbook-fixtures.ts @description 留言样本复用自然内容，真实写入回复、审核、置顶与回应，不复制演示状态 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID, createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { mockDateGroups, mockPinnedMessage } from '../../../../frontend/web-blog/app/features/guestbook/mock'
import { GuestbookMessage } from '../entities/guestbook-message.entity'
import { GuestbookReaction, GUESTBOOK_REACTIONS } from '../entities/guestbook-reaction.entity'
import type { GuestbookReactionKind } from '../entities/guestbook-reaction.entity'
import { MediaAsset } from '../entities/media-asset.entity'
import { GuestbookReadService } from '../modules/guestbook/guestbook-read.service'
import { GuestbookWriteService, lockGuestbook } from '../modules/guestbook/guestbook-write.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { mediaUrl } from '../modules/media/media-references'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const GUESTBOOK_DATASET = 'guestbook-v1'
const messages = mockDateGroups.flatMap((group) => group.messages).slice(0, 28)
export const GUESTBOOK_FIXTURE_COUNT =
  messages.length +
  2 +
  messages
    .slice(0, 4)
    .reduce(
      (sum, message) =>
        sum +
        (message.reactions ?? [])
          .filter((reaction) => GUESTBOOK_REACTIONS.includes(reaction.emoji as GuestbookReactionKind))
          .reduce((count, reaction) => count + Math.min(reaction.count, 3), 0),
      0,
    )
const visitor = (name: string) => createHash('sha256').update(`development/guestbook-v1/${name}`).digest('hex')
export async function seedGuestbookFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  await lockGuestbook(em)
  const imageId = await ensureFixture(
    em,
    GUESTBOOK_DATASET,
    'portrait',
    'media',
    async () => {
      const buffer = await readFile(resolve(__dirname, '../../../../frontend/web-blog/public/avatar-photo.webp'))
      const id = randomUUID()
      createdMedia.push(id)
      return (
        await new MediaService(em, storage).upload(
          { buffer, originalname: 'portrait.webp', mimetype: 'image/webp', size: buffer.length },
          '人物肖像',
          id,
        )
      ).id
    },
    progress,
  )
  if (!imageId) return
  const image = await em.findOne(MediaAsset, { id: imageId, deletedAt: null })
  if (!image || !(await storage.readIfExists(image.storageKey))) {
    progress.unavailable.push('guestbook-v1/media/file')
    return
  }
  const service = new GuestbookWriteService(em, new GuestbookReadService(em))
  const now = new Date()
  const ids = new Map<number, number>()
  for (const [index, source] of messages.entries()) {
    const status = index >= 27 ? 'hidden' : index >= 25 ? 'pending' : 'published'
    const id = await ensureFixture(
      em,
      GUESTBOOK_DATASET,
      String(index),
      'guestbook',
      async () => {
        const candidate = source.replyTo ? ids.get(source.replyTo.id) : undefined
        const parent = candidate
          ? await em.findOne(GuestbookMessage, { id: candidate, status: 'published', deletedAt: null })
          : null
        const note = await service.create(
          {
            requestId: randomUUID(),
            content: source.content.slice(0, 500),
            replyToId: parent?.id ?? null,
            ...(source.isOwner
              ? {}
              : { author: source.author.slice(0, 32), avatar: index === 0 ? mediaUrl(imageId) : '' }),
          },
          visitor(source.author),
          source.isOwner ? 'fixture-owner' : undefined,
        )
        const actual = await em.findOneOrFail(GuestbookMessage, { id: note.id })
        if (actual.status !== status) await service.update(note.id, { revision: actual.revision, status })
        await em.nativeUpdate(
          GuestbookMessage,
          { id: note.id },
          { createdAt: new Date(now.getTime() - (messages.length - index) * 86400000) },
        )
        return note.id
      },
      progress,
    )
    if (id) ids.set(source.id, Number(id))
  }
  await ensureFixture(
    em,
    GUESTBOOK_DATASET,
    'welcome',
    'guestbook',
    async () => {
      const note = await service.create(
        { requestId: randomUUID(), content: mockPinnedMessage.content },
        '',
        'fixture-owner',
      )
      if (!(await em.count(GuestbookMessage, { isPinned: true, status: 'published', deletedAt: null }))) {
        const current = await em.findOneOrFail(GuestbookMessage, { id: note.id })
        await service.update(note.id, { revision: current.revision, isPinned: true })
      }
      return note.id
    },
    progress,
  )
  for (const [index, source] of messages.slice(0, 4).entries()) {
    for (const reaction of source.reactions ?? []) {
      if (!GUESTBOOK_REACTIONS.includes(reaction.emoji as GuestbookReactionKind)) continue
      for (let person = 0; person < Math.min(reaction.count, 3); person++) {
        await ensureFixture(
          em,
          GUESTBOOK_DATASET,
          `${index}:${reaction.emoji}:${person}`,
          'guestbook-reaction',
          async () => {
            const id = ids.get(source.id)
            if (!id || !(await em.findOne(GuestbookMessage, { id, status: 'published', deletedAt: null }))) return null
            const identity = visitor(`reaction:${person}`)
            await service.react(id, identity, { emoji: reaction.emoji as GuestbookReactionKind, reacted: true })
            return (
              await em.findOneOrFail(GuestbookReaction, {
                message: id,
                visitorIdHash: identity,
                emoji: reaction.emoji as GuestbookReactionKind,
              })
            ).id
          },
          progress,
        )
      }
    }
  }
}
