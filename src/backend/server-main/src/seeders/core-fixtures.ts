/** @file core-fixtures.ts @description 核心业务增量样本；正文使用自然内容，归属仅记录在内部账本 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { MediaService } from '../modules/media/media.service'
import { MediaAsset } from '../entities/media-asset.entity'
import type { MediaStorage } from '../modules/media/media-storage'
import { mediaUrl, synchronizeMediaReferences } from '../modules/media/media-references'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { AdminFlashService } from '../modules/flash/admin-flash.service'
import { FlashService } from '../modules/flash/flash.service'
import { MomentWriteService } from '../modules/moment/moment-write.service'
import { MomentReadService } from '../modules/moment/moment-read.service'
import { Post } from '../entities/post.entity'
import { Comment } from '../entities/comment.entity'
import { FlashNote } from '../entities/flash-note.entity'
import { FlashComment } from '../entities/flash-comment.entity'
import { Moment } from '../entities/moment.entity'
import { MomentComment } from '../entities/moment-comment.entity'
import { PostLike } from '../entities/post-like.entity'
import { FlashLike } from '../entities/flash-like.entity'
import { MomentLike } from '../entities/moment-like.entity'
import { SiteSettings } from '../entities/site-settings.entity'
import { visibleCommentWhere } from '../modules/comment/comment-visibility'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const CORE_DATASET = 'core-v1'
const topics = [
  '把复杂问题拆成小步骤',
  '周末的公园散步',
  '一次慢请求的排查',
  '读书时记下的句子',
  '让表单反馈更清楚',
  '整理桌面与工作习惯',
  '为旧代码补充边界',
  '傍晚路过的街角',
  '从日志定位一次故障',
  '照片里的光和影',
  '做好一件小事',
  '记录一次版本升级',
  '把想法写成清单',
  '缓存更新的时机',
  '读完一本书之后',
  '页面中的留白与节奏',
  '暂存的写作计划',
  '留待以后展开的话题',
]
const commentStatuses = ['published', 'published', 'pending', 'hidden'] as const
const likers = ['晨曦', '小林'] as const
export const CORE_FIXTURE_COUNT = 1 + topics.length * 3 + commentStatuses.length * 2 + 2 + likers.length * 3
const visitor = (name: string) => createHash('sha256').update(`development/core-v1/${name}`).digest('hex')
export async function seedCoreFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
  const today = new Date()
  const date = (index: number) => new Date(today.getTime() - index * 86400000)
  const mediaId = await ensureFixture(
    em,
    CORE_DATASET,
    'portrait',
    'media',
    async () => {
      const buffer = await readFile(resolve(__dirname, '../../../../frontend/web-blog/public/avatar-photo.webp'))
      const id = randomUUID()
      createdMedia.push(id)
      const asset = await new MediaService(em, storage).upload(
        { buffer, originalname: 'portrait.webp', mimetype: 'image/webp', size: buffer.length },
        '一张人物肖像',
        id,
      )
      return asset.id
    },
    progress,
  )
  if (!mediaId) return
  const asset = await em.findOne(MediaAsset, { id: mediaId, deletedAt: null })
  if (!asset || !(await storage.readIfExists(asset.storageKey))) {
    progress.unavailable.push('core-v1/media/file')
    return
  }
  const image = mediaUrl(mediaId)
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const flashes = new AdminFlashService(em, new FlashService(em))
  const moments = new MomentWriteService(em, new MomentReadService(em))
  let primaryPost: string | null = null,
    primaryFlash: string | null = null,
    primaryMoment: string | null = null
  for (let index = 0; index < topics.length; index++) {
    const status = index === 16 ? 'draft' : index === 17 ? 'archived' : 'published'
    const content = `${topics[index]}。\n\n把当时的想法和处理过程记下来，日后回看时，也能看见自己慢慢进步的轨迹。`
    const postId = await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'post',
      async () => {
        const input = Object.assign(new SavePostDto(), {
          title: topics[index],
          summary: content,
          contentRaw: `# ${topics[index]}\n\n${content}\n\n![人物肖像](${image})`,
          cover: image,
          coverAlt: '人物肖像',
          folder: index % 2 ? '随笔日记' : '前端开发',
          category: index % 2 ? 'life' : 'tech',
          tags: [index % 2 ? '生活日常' : '技术分享'],
          status,
        })
        const saved = await posts.save(null, input, '开发数据集初次创建')
        await em.nativeUpdate(Post, { id: saved.id }, { createdAt: date(index), publishedAt: date(index) })
        return saved.id
      },
      progress,
    )
    const flashId = await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'flash',
      async () => {
        const saved = await flashes.save(null, {
          content,
          tags: [index % 2 ? '生活' : '技术'],
          images: index % 3 === 0 ? [image] : [],
          type: index % 3 === 0 ? 'idea' : index % 3 === 1 ? 'todo' : 'memo',
          isDraft: status === 'draft',
          isArchived: status === 'archived',
        })
        await em.nativeUpdate(FlashNote, { id: saved.id }, { createdAt: date(index) })
        return saved.id
      },
      progress,
    )
    const momentId = await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'moment',
      async () => {
        const linked = postId
          ? await em.findOne(Post, { id: Number(postId), status: 'published', deletedAt: null })
          : null
        const saved = await moments.save(null, {
          content,
          status,
          topics: [index % 2 ? '生活日常' : '技术分享'],
          images: index % 3 === 0 ? [image] : [],
          linkedArticleId: index === 0 ? (linked?.id ?? null) : null,
          requestId: randomUUID(),
          location: index % 2 ? '街角公园' : null,
          isPinned: false,
        })
        await em.nativeUpdate(
          Moment,
          { id: saved.id },
          { createdAt: date(index), publishedAt: status === 'published' ? date(index) : null },
        )
        return saved.id
      },
      progress,
    )
    if (index === 0) {
      primaryPost = postId
      primaryFlash = flashId
      primaryMoment = momentId
    }
  }
  let parent: string | null = null
  for (const [index, status] of commentStatuses.entries()) {
    const owned = index === 1
    const author = owned ? site.values.ownerName : ['晨曦', '小林', '远山', '清和'][index]!
    const avatar = owned ? site.values.avatar : image
    const content = owned ? '谢谢交流，把这些想法记录下来也是很好的收获。' : '读到这里很有共鸣，也想听听大家的经验。'
    const comment = await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'comment',
      async () => {
        if (
          !primaryPost ||
          !(await em.findOne(Post, { id: Number(primaryPost), status: 'published', deletedAt: null }))
        )
          return null
        const post = em.getReference(Post, Number(primaryPost))
        const value = em.create(Comment, {
          post,
          parent: index === 1 && parent ? em.getReference(Comment, Number(parent)) : undefined,
          depth: index === 1 && parent ? 1 : 0,
          authorSnapshot: { name: author, avatar, visitorIdHash: visitor(author) },
          content,
          isOwner: owned,
          status: status as Comment['status'],
          likes: 0,
          createdAt: date(0),
        })
        await em.flush()
        await synchronizeMediaReferences(em, `comment:${value.id}`, 'comment', [avatar], { post, comment: value })
        post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
        return value.id
      },
      progress,
    )
    if (index === 0) parent = comment
    await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'moment-comment',
      async () => {
        if (!primaryMoment || !(await em.findOne(Moment, { id: primaryMoment, status: 'published', deletedAt: null })))
          return null
        const moment = em.getReference(Moment, primaryMoment)
        const value = em.create(MomentComment, {
          moment,
          visitorIdHash: visitor(author),
          author,
          avatar,
          content,
          status: status as MomentComment['status'],
          isOwner: owned,
          createdAt: date(0),
        })
        await em.flush()
        await synchronizeMediaReferences(em, `moment-comment:${value.id}`, 'moment-comment', [avatar], {
          moment,
          momentComment: value,
        })
        return value.id
      },
      progress,
    )
    if (index < 2)
      await ensureFixture(
        em,
        CORE_DATASET,
        String(index),
        'flash-comment',
        async () => {
          if (!primaryFlash || !(await em.findOne(FlashNote, { id: primaryFlash, isDraft: false, isArchived: false })))
            return null
          const flashNote = em.getReference(FlashNote, primaryFlash)
          const value = em.create(FlashComment, {
            flashNote,
            authorId: visitor(author),
            authorName: author,
            authorAvatar: avatar,
            content,
            createdAt: date(0),
          })
          await em.flush()
          await synchronizeMediaReferences(em, `flash-comment:${value.id}`, 'flash-comment', [avatar], {
            flashNote,
            flashComment: value,
          })
          return value.id
        },
        progress,
      )
  }
  for (const name of likers) {
    await ensureFixture(
      em,
      CORE_DATASET,
      name,
      'post-like',
      async () => {
        const post = primaryPost
          ? await em.findOne(Post, { id: Number(primaryPost), status: 'published', deletedAt: null })
          : null
        if (!post) return null
        const value = em.create(PostLike, { post, visitorIdHash: visitor(name), createdAt: date(0) })
        await em.flush()
        post.likes = await em.count(PostLike, { post })
        return value.id
      },
      progress,
    )
    await ensureFixture(
      em,
      CORE_DATASET,
      name,
      'flash-like',
      async () => {
        const flashNote = primaryFlash
          ? await em.findOne(FlashNote, { id: primaryFlash, isDraft: false, isArchived: false })
          : null
        if (!flashNote) return null
        const value = em.create(FlashLike, { flashNote, visitorIdHash: visitor(name), createdAt: date(0) })
        await em.flush()
        flashNote.likes = await em.count(FlashLike, { flashNote })
        return value.id
      },
      progress,
    )
    await ensureFixture(
      em,
      CORE_DATASET,
      name,
      'moment-like',
      async () => {
        const moment = primaryMoment
          ? await em.findOne(Moment, { id: primaryMoment, status: 'published', deletedAt: null })
          : null
        if (!moment) return null
        const value = em.create(MomentLike, { moment, visitorIdHash: visitor(name), createdAt: date(0) })
        await em.flush()
        moment.likes = await em.count(MomentLike, { moment })
        return value.id
      },
      progress,
    )
  }
}
