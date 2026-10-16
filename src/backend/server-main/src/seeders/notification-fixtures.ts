/** @file notification-fixtures.ts @description 自然互动的可浏览通知样本；通过真实事件生成，外部队列始终暂停 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { MediaStorage } from '../modules/media/media-storage'
import type { FixtureProgress } from './fixture-ledger'
import { ensureFixture } from './fixture-ledger'
import { randomUUID, createHash } from 'node:crypto'
import { GuestbookReadService } from '../modules/guestbook/guestbook-read.service'
import { GuestbookWriteService } from '../modules/guestbook/guestbook-write.service'
import { GuestbookMessage } from '../entities/guestbook-message.entity'
import { CreateCommentDto } from '../modules/comment/dto/create-comment.dto'
import { withoutExternalNotifications } from '../modules/operations/owner-events'
import { Post } from '../entities/post.entity'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { MomentWriteService } from '../modules/moment/moment-write.service'
import { MomentReadService } from '../modules/moment/moment-read.service'
import { CommentService } from '../modules/comment/comment.service'
import { MomentInteractionService } from '../modules/moment/moment-interaction.service'

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
// 通知中心按来源区分留言、文章评论、动态评论与任务故障；留言之外的互动此前没有样本。
const articleNotes: [string, string][] = [
  ['远山', '插槽约定这块能展开讲讲吗？尤其是右栏那部分。'],
  ['海风', '我也在做主题切换，请问降级逻辑是写在主题里还是页面里？'],
]
const momentNotes: [string, string][] = [
  ['林间', '期待这篇，我上次改主题改到一半放弃了。'],
  ['星野', '插槽这个思路可以用在别的地方吗？'],
]
export const CONTENT_NOTIFICATION_COUNT = 2 + (articleNotes.length + momentNotes.length) * 3
const visitorOf = (name: string) => createHash('sha256').update(`${NOTIFICATION_DATASET}/${name}`).digest('hex')
/** 文章评论与动态评论各自产生真实通知，覆盖留言之外的通知来源。 */
async function seedContentNotifications(em: EntityManager, progress: FixtureProgress) {
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const moments = new MomentWriteService(em, new MomentReadService(em))
  const comments = new CommentService(em)
  const interactions = new MomentInteractionService(em)
  const postId = await ensureFixture(
    em,
    NOTIFICATION_DATASET,
    'source',
    'post',
    async () => {
      const input = Object.assign(new SavePostDto(), {
        title: '主题引擎重写：换主题不再需要动页面结构',
        summary: '把主题相关的判断从页面里收回到主题自己手上，顺带记录改完之后的几处取舍。',
        contentRaw:
          '# 主题引擎重写\n\n以前换主题要同时改页面和组件，判断散在两头。这次把插槽约定定死，页面只管内容，主题只管呈现。\n\n改完之后右栏在窄屏下的降级逻辑收敛到一处，三套主题共用同一份内容也不再需要各自兜底。',
        folder: '前端开发',
        category: 'tech',
        tags: ['技术分享'],
        status: 'published',
      })
      const saved = await posts.save(null, input, '通知样本来源')
      await em.nativeUpdate(Post, { id: saved.id }, { views: 530 })
      return saved.id
    },
    progress,
  )
  const momentId = await ensureFixture(
    em,
    NOTIFICATION_DATASET,
    'source',
    'moment',
    async () => {
      const saved = await moments.save(null, {
        content: '主题引擎重写完了，换主题不用再动页面结构。',
        status: 'published',
        topics: ['技术分享'],
        images: [],
        linkedArticleId: null,
        requestId: randomUUID(),
        location: null,
        isPinned: false,
      })
      return saved.id
    },
    progress,
  )
  // 通知连带的投递任务同样登记归属，否则清理计划会因为存在未知任务而整组保留。
  const link = async (scenario: string, kind: 'comment' | 'moment-comment', sourceId: string, read: boolean) => {
    const notification = await ensureFixture(
      em,
      NOTIFICATION_DATASET,
      scenario,
      'notification',
      async () => {
        const [event] = await em.execute<{ id: string }[]>(
          'select id from owner_notification where kind=? and source_id=?',
          [kind, sourceId],
        )
        if (!event) return null
        if (read) await em.execute('update owner_notification set read_at=now() where id=?', [event.id])
        return event.id
      },
      progress,
    )
    if (!notification) return
    await ensureFixture(
      em,
      NOTIFICATION_DATASET,
      scenario,
      'task',
      async () => {
        const [task] = await em.execute<{ id: string }[]>(
          "select id from background_task where payload->>'notificationId'=?",
          [notification],
        )
        return task?.id ?? null
      },
      progress,
    )
  }
  if (postId)
    for (const [index, [author, content]] of articleNotes.entries()) {
      const commentId = await ensureFixture(
        em,
        NOTIFICATION_DATASET,
        `article-${index}`,
        'comment',
        async () => {
          const node = await comments.create(
            Number(postId),
            Object.assign(new CreateCommentDto(), { requestId: randomUUID(), author, content }),
            visitorOf(author),
          )
          return node.id
        },
        progress,
      )
      if (commentId) await link(`article-${index}`, 'comment', commentId, index === 1)
    }
  if (momentId)
    for (const [index, [author, content]] of momentNotes.entries()) {
      const commentId = await ensureFixture(
        em,
        NOTIFICATION_DATASET,
        `moment-${index}`,
        'moment-comment',
        async () => {
          const created = await interactions.comment(
            momentId,
            { requestId: randomUUID(), author, content },
            visitorOf(author),
          )
          return created.id
        },
        progress,
      )
      if (commentId) await link(`moment-${index}`, 'moment-comment', commentId, index === 1)
    }
}
export const NOTIFICATION_FIXTURE_COUNT = questions.length * 3 + 2 + CONTENT_NOTIFICATION_COUNT
export const NOTIFICATION_EVENT_COUNT = questions.length + articleNotes.length + momentNotes.length
// 留言样本中两条、文章与动态评论各一条标记为已读，其余保持未读。
export const NOTIFICATION_READ_COUNT = 2 + 2
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
    await seedContentNotifications(em, progress)
  })
}
