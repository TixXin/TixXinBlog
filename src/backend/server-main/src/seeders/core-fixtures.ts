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
import { CORE_SCENES } from './core-scenes'
import type { FixtureProgress } from './fixture-ledger'

export const CORE_DATASET = 'core-v1'
const commentStatuses = ['published', 'published', 'pending', 'hidden'] as const
const likers = ['晨曦', '小林'] as const
export const CONVERSATION_COUNT = 20 + 4 + 1 + 1 + 6
const visitor = (name: string) => createHash('sha256').update(`development/core-v1/${name}`).digest('hex')
// 评论针对所在文章的具体内容，并接出访客提问与博主回复的对话链。
const threadNotes: readonly (readonly [string, string])[] = [
  ['远山', '插槽约定这部分能展开说说吗？我现在三套主题各写了一份兜底。'],
  ['清和', '右栏降级那段很有共鸣，我们是用媒体查询硬切的，窄屏下经常闪一下。'],
  ['松间', '升级到 4 之后 layouts 的变化确实没在迁移指南里写清楚。'],
  ['叙白', '想问下页面和主题的边界具体怎么划的，比如面包屑算谁的。'],
  ['南屿', '收藏了，正好下周要做同样的事。'],
  ['照野', '我们也是三套主题，最后放弃共用插槽各写各的，维护成本确实高。'],
  ['远山', '「以前含糊的地方必须写死」这句说到点子上了。'],
  ['清和', '插槽约定是写在类型里还是只写在文档里？'],
  ['松间', '一个下午就升完了？我们光是依赖冲突就搞了两天。'],
  ['叙白', '右栏那块能说下具体的降级顺序吗？'],
  ['南屿', '我是用 provide/inject 传主题能力的，不知道有没有坑。'],
  ['照野', '这种重构最好挑没有新需求的时候做，不然两头跑。'],
  ['远山', '看完把自己的布局约定也整理了一遍，发现有三处重复。'],
  ['清和', '迁移的时候有没有遇到 SSR 水合不一致？'],
  ['松间', '写得很清楚，尤其是「哪些由页面决定」那段。'],
  ['叙白', '我们这边主题是运行时切换的，不知道这个方案能不能支持。'],
  ['南屿', '插槽名字有统一规范吗，还是各主题自己约定。'],
  ['照野', '顺带问一句，三套主题的 CSS 变量是怎么组织的？'],
  ['远山', '之前一直纠结该把判断放哪，这篇帮了大忙。'],
  ['清和', '期待后续讲主题变量的部分。'],
]
// 回复挂在对应主楼下，其中博主回答两条，另两条是访客补充与追问。
const replyNotes: readonly (readonly [number, string, boolean, string])[] = [
  [0, '插槽约定写在类型里，页面只声明需要哪些区域，主题决定怎么填；文档只记约定的理由。', true, ''],
  [5, '主题少的时候各写各的更快，超过三套之后共用的收益才显出来。', true, ''],
  [10, '同问，我这边的顺序是右栏收进底部折叠，再窄就整个隐藏。', false, '叙白'],
  [15, '运行时切换是支持的，主题只负责呈现，内容侧不需要重新取数。', true, ''],
]
const deepNote: readonly [string, string] = [
  '远山',
  '明白了。那如果某个主题不提供这个区域呢，是降级到默认还是直接报错？',
]
const longNote: readonly [string, string] = [
  '松间',
  '照着这个思路把我们的三套主题梳理了一遍。最费劲的不是写插槽，而是先把「这块内容到底归谁管」问清楚：' +
    '面包屑、右栏、页脚这三处原先页面和主题都在管，改完之后才发现以前的闪烁就是两边同时写造成的。' +
    '另外提醒一点，收敛降级逻辑之后记得回头看窄屏，我们漏了一处，右栏折叠后底部多出一段空白，过了两周才有人反馈。',
]
const spreadNotes: readonly (readonly [string, string, string, string, string])[] = [
  [
    '南屿',
    '彩田路那段上坡确实折磨，我一般从梅林关那边绕过去。',
    '照野',
    '23 公里不错了，我上次 15 公里就歇了三次。',
    'pending',
  ],
  [
    '清和',
    '复合索引里排序字段放第几位很关键，顺序错了照样走顺序扫描。',
    '松间',
    '我们遇到过类似的，最后是加覆盖索引解决的。',
    'published',
  ],
  [
    '叙白',
    '「发散式变化」这个词我第一次读完全没懂，后来被坑过才明白。',
    '远山',
    '这本我读了三遍，每次在意的地方都不一样。',
    'published',
  ],
]
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
    owned = false,
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
          authorSnapshot: {
            name: owned ? site.values.ownerName : author,
            avatar: site.values.avatar,
            visitorIdHash: visitor(owned ? 'owner' : author),
          },
          content,
          isOwner: owned,
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
  for (const [index, [author, content]] of threadNotes.entries())
    roots.push(
      await create(
        `thread-${index}`,
        primary,
        author,
        content,
        index === 5 ? 'pending' : index === 11 ? 'hidden' : 'published',
        null,
        48 - index,
      ),
    )
  const replies: (string | null)[] = []
  for (const [position, [rootIndex, content, owned, author]] of replyNotes.entries())
    replies.push(
      roots[rootIndex]
        ? await create(
            `reply-${position}`,
            primary,
            author,
            content,
            'published',
            roots[rootIndex],
            24 - position,
            owned,
          )
        : null,
    )
  // 提问者在博主回复之后继续追问，形成三层对话。
  if (replies[0]) await create('deep-0', primary, deepNote[0], deepNote[1], 'published', replies[0], 12)
  await create('long-0', primary, longNote[0], longNote[1], 'published', null, 6)
  for (const [position, postId] of publishedPosts.slice(1, 4).entries()) {
    const [firstAuthor, firstText, secondAuthor, secondText, secondStatus] = spreadNotes[position]!
    await create(`spread-${position}-0`, postId, firstAuthor, firstText, 'published', null, 36 - position)
    await create(
      `spread-${position}-1`,
      postId,
      secondAuthor,
      secondText,
      secondStatus as Comment['status'],
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
// 配图档位对应前端网格，但每一组仍然是一次具体的拍摄：地点、正文与选图相互对应。
const burstScenes = [
  {
    assets: ['ridge', 'skyline'],
    place: '深圳 · 莲花山',
    text: '同一天，山上和城里各拍了一张。',
    flash: '山顶和山下的光完全是两种，隔了不到两小时。',
  },
  {
    assets: ['mist', 'ridge', 'lake'],
    place: '云南 · 西双版纳',
    text: '等雾散等了半小时，最后三张都留下了。',
    flash: '晨雾散得比想象中慢，等了半小时。',
  },
  {
    assets: ['breakfast', 'skyline', 'night', 'portrait'],
    place: null,
    text: '从早餐拍到夜里，一天下来挑出四张。',
    flash: '一天四张，从早餐到夜景。',
  },
  {
    assets: ['ridge', 'night', 'pizza', 'lake', 'skyline', 'breakfast', 'portrait', 'mist'],
    place: null,
    text: '整理硬盘翻出来的，去年到今年陆陆续续拍的。',
    flash: '整理硬盘，翻出去年到今年的一堆片子。',
  },
] as const
const longFlashText =
  '把这两周做的事情梳理了一遍：先是把几个老接口的边界补齐，顺手把重复的判断抽成了共用函数；' +
  '然后是整理图片资源，统一换成更合适的尺寸，页面首屏明显轻了一些；最后花了小半天重新读自己半年前写的笔记，' +
  '发现当时觉得想清楚的地方，现在看其实留了不少含糊。记录这件事的意义大概就在这里，它让你有机会和过去的判断对账。'
const longMomentText =
  '今天把书桌整个清了一遍，抽屉里翻出不少以前的小东西：写坏的笔、几张票根、一本只记了三页的本子。' +
  '本想全部丢掉，最后还是留了几样。清理的时候一直在想，东西本身其实没那么重要，' +
  '真正占地方的是「说不定以后会用到」这个念头。留下的那几样，是因为确实还记得当时的事。'
/** 配图数量与超长正文在闪念和朋友圈各有代表，覆盖前端的单图、两列与三列布局。 */
/** 上传场景共用的图片素材，按素材名返回媒体地址；重复补种时复用已有资源。 */
async function ensureSceneAssets(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const assets = new Map<string, string>()
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
    if (id) assets.set(name, mediaUrl(id))
  }
  return assets
}
async function seedImageBursts(
  em: EntityManager,
  progress: FixtureProgress,
  assets: Map<string, string>,
  portrait: string,
  flashes: AdminFlashService,
  moments: MomentWriteService,
  date: (index: number) => Date,
) {
  for (const [slot, scene] of burstScenes.entries()) {
    // 九张一组需要再补一张人像，凑满铺满三行的边界。
    const images = [...scene.assets.map((name) => assets.get(name)), ...(slot === 3 ? [portrait] : [])].filter(
      (url): url is string => !!url,
    )
    const count = images.length
    if (count < scene.assets.length) continue
    await ensureFixture(
      em,
      CORE_DATASET,
      `burst-${count}`,
      'flash',
      async () => {
        const saved = await flashes.save(null, {
          content: scene.flash,
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
          content: scene.text,
          status: 'published',
          topics: ['生活日常'],
          images,
          linkedArticleId: null,
          requestId: randomUUID(),
          location: scene.place,
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
        images: [portrait],
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
    '把提交信息写成将来查得到的样子',
    '提交信息写给的是三个月后的自己。这篇没有配图，只有几条用下来确实有效的写法。',
    30,
    false,
  ],
  [
    'long-title',
    '零成本用 GitHub Actions 跑完构建、测试与部署的完整配置记录',
    '从零开始配一条流水线：触发条件、缓存策略、测试并行、产物上传，以及几个踩过的坑。标题很长，正好用来确认列表和详情页的换行。',
    31,
    true,
  ],
  [
    'same-day',
    '同一天又写了一篇：关于提交粒度',
    '上一篇写完想起还有一半没说，索性同一天再写一篇，顺便确认归档按日期分组时同组内的排序。',
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
        await em.nativeUpdate(
          Post,
          { id: saved.id },
          {
            createdAt: date(offset),
            publishedAt: date(offset),
            views: covered ? 870 : scenario === 'plain' ? 240 : 160,
          },
        )
        return saved.id
      },
      progress,
    )
}
export const BURST_COUNT = burstAssets.length + 4 * 2 + 2 + edgeArticles.length
export const CORE_FIXTURE_COUNT =
  2 + CORE_SCENES.length * 3 + commentStatuses.length * 2 + 2 + likers.length * 3 + CONVERSATION_COUNT + BURST_COUNT
export async function seedCoreFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
  const today = new Date()
  const date = (index: number) => new Date(today.getTime() - index * 86400000)
  // 按天数派生固定但不规则的时分，避免所有内容堆在同一时刻。
  const at = (days: number) => {
    const value = date(days)
    value.setHours(8 + ((days * 7) % 12), (days * 23) % 60, 0, 0)
    return value
  }
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
  const assets = await ensureSceneAssets(em, storage, progress, createdMedia)
  const sceneImages = (names: readonly string[]) =>
    names.map((name) => assets.get(name)).filter((url): url is string => !!url)
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const flashes = new AdminFlashService(em, new FlashService(em))
  const moments = new MomentWriteService(em, new MomentReadService(em))
  let primaryPost: string | null = null,
    primaryFlash: string | null = null,
    primaryMoment: string | null = null
  const publishedPosts: string[] = []
  for (const [index, scene] of CORE_SCENES.entries()) {
    const status = index === 16 ? 'draft' : index === 17 ? 'archived' : 'published'
    const momentImages = sceneImages(scene.moment.assets)
    const cover = momentImages[0] ?? ''
    const when = at(scene.days)
    const postId = await ensureFixture(
      em,
      CORE_DATASET,
      String(index),
      'post',
      async () => {
        const input = Object.assign(new SavePostDto(), {
          title: scene.title,
          summary: scene.summary,
          contentRaw: cover
            ? `# ${scene.title}\n\n${scene.body}\n\n![${scene.title}](${cover})`
            : `# ${scene.title}\n\n${scene.body}`,
          cover,
          coverAlt: cover ? scene.title : '',
          folder: scene.folder,
          category: scene.category,
          tags: [...scene.tags],
          readTimeMinutes: scene.readTime,
          status,
        })
        const saved = await posts.save(null, input, '开发数据集初次创建')
        await em.nativeUpdate(Post, { id: saved.id }, { createdAt: when, publishedAt: when, views: scene.views })
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
          content: scene.flash.text,
          tags: [...scene.flash.tags],
          images: sceneImages(scene.flash.assets ?? []),
          type: scene.flash.type,
          isDraft: status === 'draft',
          isArchived: status === 'archived',
        })
        await em.nativeUpdate(FlashNote, { id: saved.id }, { createdAt: when })
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
          content: scene.moment.text,
          status,
          topics: [scene.moment.topic],
          images: momentImages,
          linkedArticleId: index === 0 ? (linked?.id ?? null) : null,
          requestId: randomUUID(),
          location: scene.moment.place,
          isPinned: false,
        })
        await em.nativeUpdate(
          Moment,
          { id: saved.id },
          { createdAt: when, publishedAt: status === 'published' ? when : null },
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
    const content = owned
      ? '补充一句：插槽约定改完之后，三套主题的兜底代码删掉了两百多行。'
      : [
          '跟着把自己项目的布局约定也理了一遍，确实清爽不少。',
          '',
          '请问插槽约定有没有版本概念？主题升级的时候怎么兼容旧约定。',
          '这个思路我们试过，但当时没把边界定清楚，最后又退回去了。',
        ][index] || '跟着把自己项目的布局约定也理了一遍，确实清爽不少。'
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
          content: owned ? '对，改完之后右栏那块逻辑只剩一处了。' : '这一下午看来没白熬。',
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
            content: owned ? '是的，收敛到一处之后维护省心很多。' : '四处收敛到一处，这个数字挺有说服力。',
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
  await seedImageBursts(em, progress, assets, image, flashes, moments, date)
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
