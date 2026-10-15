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
export const CONVERSATION_COUNT = 20 + 4 + 1 + 1 + 6
const visitor = (name: string) => createHash('sha256').update(`development/core-v1/${name}`).digest('hex')
const threadVoices = ['远山', '清和', '松间', '叙白', '南屿', '照野']
const threadRemarks = [
  '按这个顺序走了一遍，确实比以前顺手。',
  '中间那段取舍写得很实在，不是只讲好的一面。',
  '补充一点：我这边是先确认现象再缩小范围。',
  '收藏了，等下次遇到同样的情况再回来看。',
  '最后一条结论对我帮助最大。',
  '想问下数据量更大的时候还适用吗。',
  '同样的问题我也遇到过，当时绕了不少路。',
  '看完顺手把自己的笔记整理了一遍。',
  '这里的判断依据能再展开讲讲吗。',
  '谢谢分享，照着做之后省了很多时间。',
]
const longRemark =
  '读完之后又回头看了一遍中间的排查过程。我自己遇到类似情况时，习惯先把现象和时间点记下来，再逐个排除可能的原因，' +
  '最容易出错的地方是过早认定某个结论，然后把后面的证据都往这个结论上靠。这篇里把走过的弯路也写出来了，对照着看很有帮助，' +
  '尤其是最后关于什么时候应该停下来重新梳理的那段。'
/** 公开评论需要足够的条数分页，并覆盖多层回复、审核状态与跨文章分布。 */
async function seedConversation(
  em: EntityManager,
  publishedPosts: string[],
  site: SiteSettings,
  progress: FixtureProgress,
) {
  if (!publishedPosts.length) return
  const touched = new Set<string>()
  const create = async (
    scenario: string,
    postId: string,
    author: string,
    content: string,
    status: Comment['status'],
    parentId: string | null,
    offsetHours: number,
  ) =>
    ensureFixture(
      em,
      CORE_DATASET,
      scenario,
      'comment',
      async () => {
        const post = await em.findOne(Post, { id: Number(postId), status: 'published', deletedAt: null })
        if (!post) return null
        const parent = parentId ? await em.findOne(Comment, { id: Number(parentId) }) : null
        if (parentId && !parent) return null
        const value = em.create(Comment, {
          post,
          parent: parent ?? undefined,
          depth: parent ? parent.depth + 1 : 0,
          authorSnapshot: { name: author, avatar: site.values.avatar, visitorIdHash: visitor(author) },
          content,
          isOwner: false,
          status,
          likes: 0,
          createdAt: new Date(Date.now() - offsetHours * 3600000),
        })
        await em.flush()
        touched.add(postId)
        return value.id
      },
      progress,
    )
  const primary = publishedPosts[0]!
  const roots: (string | null)[] = []
  for (let index = 0; index < 20; index++)
    roots.push(
      await create(
        `thread-${index}`,
        primary,
        threadVoices[index % threadVoices.length]!,
        threadRemarks[index % threadRemarks.length]!,
        index === 5 ? 'pending' : index === 11 ? 'hidden' : 'published',
        null,
        48 - index,
      ),
    )
  const replies: (string | null)[] = []
  for (const [position, rootIndex] of [0, 5, 10, 15].entries())
    replies.push(
      roots[rootIndex]
        ? await create(
            `reply-${position}`,
            primary,
            threadVoices[(position + 2) % threadVoices.length]!,
            threadRemarks[(position + 4) % threadRemarks.length]!,
            'published',
            roots[rootIndex],
            24 - position,
          )
        : null,
    )
  if (replies[0])
    await create(
      'deep-0',
      primary,
      threadVoices[1]!,
      '接着上面的回复补一句：这一步也可以放到最后再做。',
      'published',
      replies[0],
      12,
    )
  await create('long-0', primary, threadVoices[3]!, longRemark, 'published', null, 6)
  for (const [position, postId] of publishedPosts.slice(1, 4).entries()) {
    await create(
      `spread-${position}-0`,
      postId,
      threadVoices[position]!,
      threadRemarks[position * 2]!,
      'published',
      null,
      36 - position,
    )
    await create(
      `spread-${position}-1`,
      postId,
      threadVoices[position + 3]!,
      threadRemarks[position * 2 + 1]!,
      position === 2 ? 'pending' : 'published',
      null,
      30 - position,
    )
  }
  for (const postId of touched) {
    const post = await em.findOne(Post, { id: Number(postId) })
    if (post) post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
  }
  await em.flush()
}
// 配图档位对应前端网格：1 张单图，2 与 4 张两列，3 张以上三列；九张用于铺满的边界。
const burstAssets = [
  ['ridge', '山脊轮廓'],
  ['night', '夜色里的街道'],
  ['pizza', '刚出炉的披萨'],
  ['lake', '湖面倒影'],
  ['skyline', '城市天际线'],
  ['breakfast', '一顿简单的早餐'],
  ['portrait', '侧光下的人像'],
  ['mist', '山谷晨雾'],
] as const
const burstTexts: Record<number, string> = {
  2: '周末走了两个地方，顺手各拍了一张。',
  3: '傍晚沿着河堤慢慢走，光线一直在变。',
  4: '这一天从早餐开始，到夜里的街道结束。',
  9: '把这段时间攒下的照片一次放出来，大多是路过时随手拍的。',
}
const longFlashText =
  '把这两周做的事情梳理了一遍：先是把几个老接口的边界补齐，顺手把重复的判断抽成了共用函数；' +
  '然后是整理图片资源，统一换成更合适的尺寸，页面首屏明显轻了一些；最后花了小半天重新读自己半年前写的笔记，' +
  '发现当时觉得想清楚的地方，现在看其实留了不少含糊。记录这件事的意义大概就在这里，它让你有机会和过去的判断对账。'
const longMomentText =
  '今天把书桌整个清了一遍，抽屉里翻出不少以前的小东西：写坏的笔、几张票根、一本只记了三页的本子。' +
  '本想全部丢掉，最后还是留了几样。清理的时候一直在想，东西本身其实没那么重要，' +
  '真正占地方的是「说不定以后会用到」这个念头。留下的那几样，是因为确实还记得当时的事。'
/** 配图数量与超长正文在闪念和朋友圈各有代表，覆盖前端的单图、两列与三列布局。 */
async function seedImageBursts(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
  baseImage: string,
  flashes: AdminFlashService,
  moments: MomentWriteService,
  date: (index: number) => Date,
) {
  const urls: string[] = [baseImage]
  for (const [name, alt] of burstAssets) {
    const id = await ensureFixture(
      em,
      CORE_DATASET,
      `asset-${name}`,
      'media',
      async () => {
        const buffer = await readFile(resolve(__dirname, `gallery-assets/${name}.webp`))
        const mediaId = randomUUID()
        createdMedia.push(mediaId)
        const asset = await new MediaService(em, storage).upload(
          { buffer, originalname: `${name}.webp`, mimetype: 'image/webp', size: buffer.length },
          alt,
          mediaId,
        )
        return asset.id
      },
      progress,
    )
    if (id) urls.push(mediaUrl(id))
  }
  for (const [slot, count] of [2, 3, 4, 9].entries()) {
    if (urls.length < count) continue
    const images = urls.slice(0, count)
    await ensureFixture(
      em,
      CORE_DATASET,
      `burst-${count}`,
      'flash',
      async () => {
        const saved = await flashes.save(null, {
          content: burstTexts[count]!,
          tags: ['生活'],
          images,
          type: 'memo',
          isDraft: false,
          isArchived: false,
        })
        await em.nativeUpdate(FlashNote, { id: saved.id }, { createdAt: date(slot) })
        return saved.id
      },
      progress,
    )
    await ensureFixture(
      em,
      CORE_DATASET,
      `burst-${count}`,
      'moment',
      async () => {
        const saved = await moments.save(null, {
          content: burstTexts[count]!,
          status: 'published',
          topics: ['生活日常'],
          images,
          linkedArticleId: null,
          requestId: randomUUID(),
          location: count === 9 ? '沿河步道' : null,
          isPinned: false,
        })
        await em.nativeUpdate(Moment, { id: saved.id }, { createdAt: date(slot), publishedAt: date(slot) })
        return saved.id
      },
      progress,
    )
  }
  await ensureFixture(
    em,
    CORE_DATASET,
    'long',
    'flash',
    async () => {
      const saved = await flashes.save(null, {
        content: longFlashText,
        tags: ['技术'],
        images: [],
        type: 'idea',
        isDraft: false,
        isArchived: false,
      })
      await em.nativeUpdate(FlashNote, { id: saved.id }, { createdAt: date(4) })
      return saved.id
    },
    progress,
  )
  await ensureFixture(
    em,
    CORE_DATASET,
    'long',
    'moment',
    async () => {
      const saved = await moments.save(null, {
        content: longMomentText,
        status: 'published',
        topics: ['生活日常'],
        images: [urls[0]!],
        linkedArticleId: null,
        requestId: randomUUID(),
        location: null,
        isPinned: false,
      })
      await em.nativeUpdate(Moment, { id: saved.id }, { createdAt: date(4), publishedAt: date(4) })
      return saved.id
    },
    progress,
  )
}
// 列表与卡片的边界：没有封面、标题很长、以及同一天发布多篇。
const edgeArticles: readonly (readonly [string, string, string, number, boolean])[] = [
  [
    'plain',
    '只有文字的一则短记',
    '这篇没有配图，用来确认列表和详情在缺少封面时的排布。正文不长，标题也普通，是最常见的一种内容形态。',
    30,
    false,
  ],
  [
    'long-title',
    '关于在内容整理过程中如何安排标题长度与摘要信息的一些具体做法和注意事项',
    '标题很长时，列表卡片、归档行和详情页的处理方式各不相同，需要分别确认换行、截断与悬停提示的表现。',
    31,
    true,
  ],
  [
    'same-day',
    '同一天写下的第二则',
    '与另一篇发布在同一天，用来确认按日期分组时同组内的排序是否稳定，以及归档页的日期标题会不会重复出现。',
    30,
    false,
  ],
]
/** 没有封面、超长标题与同日多篇在列表、归档和卡片上各有不同表现。 */
async function seedPostEdges(
  em: EntityManager,
  posts: AdminPostService,
  image: string,
  progress: FixtureProgress,
  date: (index: number) => Date,
) {
  for (const [scenario, title, summary, offset, covered] of edgeArticles)
    await ensureFixture(
      em,
      CORE_DATASET,
      scenario,
      'post',
      async () => {
        const input = Object.assign(new SavePostDto(), {
          title,
          summary,
          contentRaw: `# ${title}\n\n${summary}\n\n把当时的想法记下来，回看时能看出判断是怎么一步步变化的。`,
          cover: covered ? image : '',
          coverAlt: covered ? '人物肖像' : '',
          folder: '随笔日记',
          category: 'life',
          tags: ['生活日常'],
          status: 'published',
        })
        const saved = await posts.save(null, input, '补齐列表边界场景')
        await em.nativeUpdate(Post, { id: saved.id }, { createdAt: date(offset), publishedAt: date(offset) })
        return saved.id
      },
      progress,
    )
}
export const BURST_COUNT = burstAssets.length + 4 * 2 + 2 + edgeArticles.length
export const CORE_FIXTURE_COUNT =
  2 + topics.length * 3 + commentStatuses.length * 2 + 2 + likers.length * 3 + CONVERSATION_COUNT + BURST_COUNT
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
  const publishedPosts: string[] = []
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
    if (status === 'published' && postId) publishedPosts.push(postId)
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
  await seedConversation(em, publishedPosts, site, progress)
  await seedImageBursts(em, storage, progress, createdMedia, image, flashes, moments, date)
  await seedPostEdges(em, posts, image, progress, date)
  // 未被任何内容引用的媒体：媒体库需要可见的孤立资产，清理计划也要有可移除的代表。
  await ensureFixture(
    em,
    CORE_DATASET,
    'orphan',
    'media',
    async () => {
      const buffer = await readFile(resolve(__dirname, 'gallery-assets/mist.webp'))
      const id = randomUUID()
      createdMedia.push(id)
      const created = await new MediaService(em, storage).upload(
        { buffer, originalname: 'mist.webp', mimetype: 'image/webp', size: buffer.length },
        '山间晨雾',
        id,
      )
      await em.nativeUpdate(MediaAsset, { id: created.id }, { description: '山间晨雾，尚未用于任何内容。' })
      return created.id
    },
    progress,
  )
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
