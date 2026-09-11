/** @file notification-fixtures.ts @description 自然互动的可浏览通知样本；通过真实事件生成，外部队列始终暂停 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { MediaStorage } from '../modules/media/media-storage'
import type { FixtureProgress } from './fixture-ledger'
import { ensureFixture } from './fixture-ledger'
import { randomUUID, createHash } from 'node:crypto'
import { GuestbookReadService } from '../modules/guestbook/guestbook-read.service'
import { GuestbookWriteService } from '../modules/guestbook/guestbook-write.service'
import { GuestbookMessage } from '../entities/guestbook-message.entity'
import { withoutExternalNotifications } from '../modules/operations/owner-events'

export const NOTIFICATION_DATASET = 'notifications-v1'
const questions = [
  '整理长文时，章节名称是否适合保持简短？',
  '同一主题的文章可以按顺序串起来阅读吗？',
  '从搜索结果返回以后，还能保留原来的筛选吗？',
  '图片的来源说明放在作品介绍里会比较清楚吗？',
  '保存遇到网络波动时，先核对服务器版本是不是更稳妥？',
  '项目页面是否能找到相关的开发文章？',
  '关于页里暂时不想公开的资料可以先保留吗？',
  '想按图片的横竖比例挑选封面，可以在素材库筛选吗？',
  '旧文章里使用过的图片还能查到引用位置吗？',
  '文章撤回之后，原来的关联入口会一起隐藏吗？',
  '同一个素材可以在几篇文章里重复使用吗？',
  '很长的文章可以直接定位到最后一节吗？',
  '备份文件生成以后，怎样确认里面的图片齐全？',
  '恢复演练与正式数据恢复会使用不同的位置吗？',
  '同一个迁入包重复确认会再生成一份内容吗？',
  '分页切换以后，怎样回到刚才看到的位置？',
  '留言的已读标记与是否已经回复是分开的吗？',
  '评论在审核以前会出现在公开搜索里吗？',
  '新草稿适合先整理标题和提纲，再慢慢补正文吗？',
  '图片没有填写拍摄时间时，页面会如何展示？',
  '项目进展和项目是否公开可以分别维护吗？',
  '更换主题后，关于页和内容关联仍然会保留吗？',
  '媒体说明更新后，旧文章的图片引用会保持吗？',
]
const names = ['林间', '许宁', '小南', '星野', '远山', '海风']
export const NOTIFICATION_FIXTURE_COUNT = questions.length * 3 + 2
export async function seedNotificationFixtures(
  em: EntityManager,
  _storage: MediaStorage,
  progress: FixtureProgress,
  _createdMedia: string[],
) {
  const service = new GuestbookWriteService(em, new GuestbookReadService(em))
  await withoutExternalNotifications(async () => {
    for (const [index, content] of questions.entries()) {
      const id = await ensureFixture(
        em,
        NOTIFICATION_DATASET,
        String(index),
        'guestbook',
        async () => {
          const note = await service.create(
            { requestId: randomUUID(), author: names[index % names.length]!, content, avatar: '' },
            createHash('sha256').update(`${NOTIFICATION_DATASET}/${index}`).digest('hex'),
          )
          const current = await em.findOneOrFail(GuestbookMessage, { id: note.id })
          const status = index < 3 ? 'pending' : index === questions.length - 1 ? 'hidden' : 'published'
          if (current.status !== status) await service.update(note.id, { revision: current.revision, status })
          return note.id
        },
        progress,
      )
      if (!id) continue
      const notification = await ensureFixture(
        em,
        NOTIFICATION_DATASET,
        String(index),
        'notification',
        async () => {
          const [event] = await em.execute<{ id: string }[]>('select id from owner_notification where event_key=?', [
            `guestbook:${id}`,
          ])
          if (!event) return null
          if ([4, 5].includes(index))
            await em.execute('update owner_notification set read_at=now() where id=?', [event.id])
          return event.id
        },
        progress,
      )
      if (notification)
        await ensureFixture(
          em,
          NOTIFICATION_DATASET,
          String(index),
          'task',
          async () => {
            const [task] = await em.execute<{ id: string }[]>('select id from background_task where dedupe_key=?', [
              `mail:guestbook:${id}`,
            ])
            return task?.id ?? null
          },
          progress,
        )
      if ([3, 4].includes(index))
        await ensureFixture(
          em,
          NOTIFICATION_DATASET,
          `reply-${index}`,
          'guestbook',
          async () => {
            const parent = await em.findOne(GuestbookMessage, { id: Number(id), status: 'published', deletedAt: null })
            if (!parent) return null
            return (
              await service.create(
                {
                  requestId: randomUUID(),
                  content:
                    index === 3
                      ? '来源说明会与作品介绍一起保留，未知的拍摄信息保持空白。'
                      : '可以先核对服务器结果，确认后再决定是否重试。',
                  replyToId: Number(id),
                },
                '',
                'fixture-owner',
              )
            ).id
          },
          progress,
        )
    }
  })
}
