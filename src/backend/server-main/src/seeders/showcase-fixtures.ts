/** @file showcase-fixtures.ts @description 真实感样本集：五十篇长文及评论点赞、十八条朋友圈、图库作品、当天留言与博主资料；全部经账本登记，只补缺口 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MediaService } from '../modules/media/media.service'
import { MediaAsset } from '../entities/media-asset.entity'
import type { MediaStorage } from '../modules/media/media-storage'
import { mediaUrl, synchronizeMediaReferences } from '../modules/media/media-references'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { MomentWriteService } from '../modules/moment/moment-write.service'
import { MomentReadService } from '../modules/moment/moment-read.service'
import { GalleryService } from '../modules/gallery/gallery.service'
import { GuestbookReadService } from '../modules/guestbook/guestbook-read.service'
import { GuestbookWriteService, lockGuestbook } from '../modules/guestbook/guestbook-write.service'
import { SiteSettingsService } from '../modules/site/site-settings.service'
import { visibleCommentWhere } from '../modules/comment/comment-visibility'
import { Post } from '../entities/post.entity'
import { PostTag } from '../entities/post-tag.entity'
import { PostLike } from '../entities/post-like.entity'
import { Comment } from '../entities/comment.entity'
import { Moment } from '../entities/moment.entity'
import { MomentComment } from '../entities/moment-comment.entity'
import { MomentLike } from '../entities/moment-like.entity'
import { GuestbookMessage } from '../entities/guestbook-message.entity'
import { GuestbookReaction } from '../entities/guestbook-reaction.entity'
import type { GuestbookReactionKind } from '../entities/guestbook-reaction.entity'
import { SiteSettings, SiteSettingsRevision } from '../entities/site-settings.entity'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { ensureFixture, fixtureHash, fixtureRow, FIXTURE_TABLES } from './fixture-ledger'
import type { FixtureKind, FixtureProgress } from './fixture-ledger'
import { SHOWCASE_POSTS, SHOWCASE_TAG_COLORS } from './showcase-posts'
import { SHOWCASE_MOMENTS } from './showcase-moments'
import { eligibleInitialProfile, PREPARED_PROFILE_REASON } from './prepare-personal-profile'

export const SHOWCASE_DATASET = 'showcase-v1'
// 源素材与正文随仓库保存在 src 下；编译产物里也从同一目录读取。
const CONTENT_DIR = resolve(__dirname, '../../src/seeders/showcase-content')
const ASSET_DIR = resolve(__dirname, '../../src/seeders/showcase-assets')
const SHOWCASE_PROFILE_REASON = '整理为真实感样本的博主资料：姓名、头衔、头像、在线状态、上线日期与公告'
const visitor = (name: string) => createHash('sha256').update(`development/showcase-v1/${name}`).digest('hex')
const DAY = 86400000
/** 评论作者名单；评论文件只接受这些名字，避免正文作者与头像不一致 */
export const SHOWCASE_VISITORS = [
  '小明',
  'DevLin',
  '前端小白',
  'Luna',
  'Lemon',
  'CodeMaster_张',
  '小鱼儿',
  '技术小黑',
  '摄影爱好者阿杰',
  '后端大叔',
  'CSS魔法师',
  'Miko',
  '张伟_DevOps',
  '前端小李',
  '读书人',
  '咖啡控',
  '驴友阿杰',
  '夜猫子',
  '阿澄',
  '周末厨子',
] as const
// 封面、动态配图与图库作品共用这批素材；替代文本描述画面本身。
const ASSETS: readonly (readonly [string, string])[] = [
  ['code-screen', '显示器上的代码'],
  ['server-room', '机房里的服务器机柜'],
  ['laptop-desk', '桌上打开的笔记本电脑'],
  ['code-editor', '编辑器里的代码'],
  ['macbook-code', '笔记本屏幕上的代码'],
  ['terminal', '终端窗口'],
  ['workspace', '整洁的工作台'],
  ['laptop-code', '笔记本上的代码片段'],
  ['typing', '敲击键盘的双手'],
  ['devices', '桌上的几台设备'],
  ['code-dark', '深色主题下的代码'],
  ['team-desk', '几个人围着桌子协作'],
  ['sakura', '盛开的樱花'],
  ['blossom', '枝头的花'],
  ['garden', '园林一角'],
  ['sunset-sea', '海边的夕阳'],
  ['waves', '拍岸的海浪'],
  ['sushi', '三文鱼刺身'],
  ['eel-rice', '鳗鱼饭'],
  ['reading', '翻开的书'],
  ['cloud-sea', '山顶的云海'],
  ['summit', '山顶远眺'],
  ['bookshelf', '摆满书的书架'],
  ['latte', '拉花拿铁'],
  ['city-night', '城市夜景'],
  ['cbd-night', '楼群夜色'],
  ['bay-run', '清晨跑步'],
  ['bay-sunrise', '海湾日出'],
  ['bay-track', '空旷的跑道'],
]
// 图库作品与朋友圈里的拍摄情节对应；地点与器材是样本设定。
const GALLERY_PHOTOS = [
  ['cloud-sea', '梧桐山的云海', '风景', '清晨七点到山顶，云海刚好漫过山脊。', '深圳 · 梧桐山', '', 50],
  ['summit', '山顶的风', '风景', '风很大，站稳之后才敢举起相机。', '深圳 · 梧桐山', '', 50],
  ['city-night', '福田夜色', '城市', '手持 1/4 秒，靠在栏杆上拍到的一张。', '深圳 · 福田CBD', 'Sony A7M4', 7],
  ['bay-sunrise', '深圳湾日出', '风景', '跑步跑到一半停下来等太阳出来。', '深圳 · 深圳湾', '', 86],
] as const
interface ShowcaseComment {
  author: (typeof SHOWCASE_VISITORS)[number]
  content: string
  reply?: string
}
/** 评论文件由正文作者一起维护；格式错误直接报错，不写入半截数据 */
function loadComments(key: string): ShowcaseComment[] {
  const path = resolve(CONTENT_DIR, `${key}.comments.json`)
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 6) throw new Error(`评论文件条数不合理：${path}`)
  return parsed.map((item: unknown) => {
    const value = item as Partial<ShowcaseComment>
    if (
      !value ||
      typeof value !== 'object' ||
      !SHOWCASE_VISITORS.includes(value.author as never) ||
      typeof value.content !== 'string' ||
      !value.content.trim() ||
      value.content.length > 1000 ||
      (value.reply !== undefined && (typeof value.reply !== 'string' || !value.reply.trim()))
    )
      throw new Error(`评论格式不合规：${path}`)
    return { author: value.author!, content: value.content.trim(), reply: value.reply?.trim() }
  })
}
const COMMENTS = new Map(SHOWCASE_POSTS.map((post) => [post.key, loadComments(post.key)]))
const COMMENT_COUNT = [...COMMENTS.values()].reduce(
  (sum, list) => sum + list.length + list.filter((item) => item.reply).length,
  0,
)
const POST_LIKE_COUNT = SHOWCASE_POSTS.reduce((sum, post) => sum + post.likes, 0)
const MOMENT_COMMENT_COUNT = SHOWCASE_MOMENTS.reduce((sum, moment) => sum + moment.comments.length, 0)
const MOMENT_LIKE_COUNT = SHOWCASE_MOMENTS.reduce((sum, moment) => sum + moment.likes, 0)
// 当天两条访客留言、一条博主回复，以及首条留言上的回应。
const TODAY_GUESTBOOK = [
  {
    author: 'DevLin',
    browser: 'Chrome 141',
    region: '广东深圳',
    content: '刚发现右边的站点统计已经运行一千八百多天了，五年如一日更新，佩服。想问下文章的阅读时长是怎么估算的？',
    reply: '按正文字数除以每分钟四百字估的，代码块按行数折算，粗略但够用。',
    reactions: ['👍', '👍', '👍', '🎉'] as GuestbookReactionKind[],
  },
  {
    author: 'Lemon',
    browser: 'Safari 26',
    region: '江苏南京',
    content:
      '留言板终于能看到大家用什么浏览器了，哈哈。顺便说一句，响应式原理那篇我读到一半了，effect 调度那段写得很清楚。',
    reactions: ['❤️', '❤️'] as GuestbookReactionKind[],
  },
] as const
export const SHOWCASE_FIXTURE_COUNT =
  ASSETS.length +
  SHOWCASE_POSTS.length +
  COMMENT_COUNT +
  POST_LIKE_COUNT +
  SHOWCASE_MOMENTS.length +
  MOMENT_COMMENT_COUNT +
  MOMENT_LIKE_COUNT +
  GALLERY_PHOTOS.length +
  TODAY_GUESTBOOK.length +
  TODAY_GUESTBOOK.filter((item) => 'reply' in item).length +
  TODAY_GUESTBOOK.reduce((sum, item) => sum + item.reactions.length, 0)

/** 点赞数量大，逐条 ensureFixture 往返太多；按批核对账本、批量写入并一次登记指纹 */
async function ensureMany(
  em: EntityManager,
  kind: FixtureKind,
  scenarios: readonly string[],
  create: (scenario: string) => { id: string | number } | null,
  progress: FixtureProgress,
) {
  const table = FIXTURE_TABLES[kind]
  const keys = scenarios.map((scenario) => `${SHOWCASE_DATASET}/${kind}/${scenario}`)
  const owned = new Map<string, DevelopmentFixture>()
  for (let index = 0; index < keys.length; index += 500)
    for (const item of await em.find(DevelopmentFixture, { key: { $in: keys.slice(index, index + 500) } }))
      owned.set(item.key, item)
  const ownedIds = [...owned.values()].map((item) => item.resourceId)
  const present = new Set<string>()
  for (let index = 0; index < ownedIds.length; index += 500) {
    const rows = await em.execute<{ id: unknown; deleted_at?: unknown }[]>(
      `select * from "${table}" where id::text in (${ownedIds
        .slice(index, index + 500)
        .map(() => '?')
        .join(',')})`,
      ownedIds.slice(index, index + 500),
    )
    for (const row of rows) if (!row.deleted_at) present.add(String(row.id))
  }
  const pending: { key: string; entity: { id: string | number } }[] = []
  for (const [index, key] of keys.entries()) {
    const existing = owned.get(key)
    if (existing) {
      if (present.has(existing.resourceId)) progress.retained.push(key)
      else progress.unavailable.push(key)
      continue
    }
    const entity = create(scenarios[index]!)
    if (!entity) progress.unavailable.push(key)
    else pending.push({ key, entity })
  }
  if (!pending.length) return
  await em.flush()
  const rows = new Map<string, Record<string, unknown>>()
  const ids = pending.map((item) => String(item.entity.id))
  for (let index = 0; index < ids.length; index += 500)
    for (const row of await em.execute<Record<string, unknown>[]>(
      `select * from "${table}" where id::text in (${ids
        .slice(index, index + 500)
        .map(() => '?')
        .join(',')})`,
      ids.slice(index, index + 500),
    ))
      rows.set(String(row.id), row)
  for (const { key, entity } of pending) {
    const row = rows.get(String(entity.id))
    if (!row) throw new Error('样本写入后无法确认记录')
    em.create(DevelopmentFixture, {
      key,
      dataset: SHOWCASE_DATASET,
      kind,
      resourceId: String(entity.id),
      snapshotHash: fixtureHash(row),
    })
    progress.created.push(key)
  }
  await em.flush()
}
async function ensureAssets(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const assets = new Map<string, string>()
  for (const [name, alt] of ASSETS) {
    const id = await ensureFixture(
      em,
      SHOWCASE_DATASET,
      `asset-${name}`,
      'media',
      async () => {
        const buffer = await readFile(resolve(ASSET_DIR, `${name}.webp`))
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
    if (!id) continue
    const asset = await em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset || !(await storage.readIfExists(asset.storageKey))) {
      progress.unavailable.push(`${SHOWCASE_DATASET}/media/${name}/file`)
      continue
    }
    assets.set(name, id)
  }
  return assets
}
/** 资料仍是初始值或由 prepare-profile 整理过时才写入博主资料；博主编辑过的配置原样保留 */
async function ensureProfile(em: EntityManager, progress: FixtureProgress) {
  const service = new SiteSettingsService(em)
  const current = await service.get()
  const latest = await em.findOne(SiteSettingsRevision, { revision: current.revision })
  if (latest?.reason === SHOWCASE_PROFILE_REASON) {
    progress.retained.push(`${SHOWCASE_DATASET}/site/profile`)
    return
  }
  if (!(await eligibleInitialProfile(em)) && latest?.reason !== PREPARED_PROFILE_REASON) {
    progress.unavailable.push(`${SHOWCASE_DATASET}/site/profile`)
    return
  }
  const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...values } = current
  void _updatedAt
  void _announcementUpdatedAt
  await service.save(
    {
      ...values,
      name: 'TixXin Blog',
      description: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
      ownerName: 'TixXin',
      ownerTitle: '前端开发工程师，热爱开源与技术分享',
      avatar: '/avatar-photo.webp',
      avatarAlt: 'TixXin 的头像',
      announcement: '博客已迁移至新服务器，访问速度大幅提升！',
      socials: [
        { icon: 'lucide:github', label: 'GitHub', href: 'https://github.com/TixXin' },
        { icon: 'lucide:twitter', label: 'Twitter', href: 'https://twitter.com/TixXin' },
        { icon: 'lucide:mail', label: 'Email', href: 'mailto:hi@tix.xin' },
      ],
      presenceLabel: '摆烂中',
      presenceSignature: '今天不想写代码',
      launchedAt: '2021-08-16',
      about: {
        visible: true,
        introduction:
          '我是 TixXin，在深圳做前端开发。这里记录 Vue、Nuxt 和 TypeScript 的实践，也写部署运维的踩坑、读过的书和周末去过的地方。文章尽量写清楚“为什么这么做”，而不只是“怎么做”。',
        sections: [],
      },
    },
    SHOWCASE_PROFILE_REASON,
  )
  progress.created.push(`${SHOWCASE_DATASET}/site/profile`)
}
/** 仍未被编辑过的样本里，博主署名与当前资料不一致时跟着改，其他数据集的记录同样适用；指纹随之重新登记 */
async function syncOwnerSnapshots(em: EntityManager, next: string) {
  const targets: { kind: FixtureKind; sql: string; name: (row: Record<string, unknown>) => unknown }[] = [
    {
      kind: 'comment',
      sql: `update "comment" set author_snapshot = jsonb_set(author_snapshot, '{name}', to_jsonb(?::text)) where id = ?`,
      name: (row) => (row.author_snapshot as { name?: string })?.name,
    },
    { kind: 'guestbook', sql: `update guestbook_message set author = ? where id = ?`, name: (row) => row.author },
    { kind: 'moment-comment', sql: `update moment_comment set author = ? where id = ?`, name: (row) => row.author },
  ]
  for (const target of targets) {
    for (const fixture of await em.find(DevelopmentFixture, { kind: target.kind })) {
      const row = await fixtureRow(em, target.kind, fixture.resourceId)
      if (
        !row ||
        row.deleted_at ||
        !row.is_owner ||
        target.name(row) === next ||
        fixtureHash(row) !== fixture.snapshotHash
      )
        continue
      await em.execute(target.sql, [next, fixture.resourceId])
      const updated = await fixtureRow(em, target.kind, fixture.resourceId)
      if (updated) fixture.snapshotHash = fixtureHash(updated)
    }
  }
  await em.flush()
}
async function seedPosts(
  em: EntityManager,
  assets: Map<string, string>,
  progress: FixtureProgress,
  at: (days: number) => Date,
) {
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const ids = new Map<string, number>()
  const existingTags = new Set((await em.find(PostTag, {}, { fields: ['label'] })).map((tag) => tag.label))
  for (const post of SHOWCASE_POSTS) {
    const when = at(post.days)
    const id = await ensureFixture(
      em,
      SHOWCASE_DATASET,
      post.key,
      'post',
      async () => {
        const coverId = post.cover ? assets.get(post.cover) : undefined
        if (post.cover && !coverId) return null
        const body = (await readFile(resolve(CONTENT_DIR, `${post.key}.md`), 'utf8')).trim()
        const input = Object.assign(new SavePostDto(), {
          title: post.title,
          summary: post.summary,
          contentRaw: `# ${post.title}\n\n${body}\n`,
          cover: coverId ? mediaUrl(coverId) : '',
          coverAlt: coverId ? (ASSETS.find(([name]) => name === post.cover)?.[1] ?? post.title) : '',
          folder: post.folder,
          category: post.category,
          tags: [...post.tags],
          readTimeMinutes: post.readTime,
          pinned: post.pinned ?? false,
          status: 'published',
        })
        const saved = await posts.save(null, input, '真实感样本集初次创建')
        await em.nativeUpdate(Post, { id: saved.id }, { createdAt: when, publishedAt: when, views: post.views })
        return saved.id
      },
      progress,
    )
    if (id) ids.set(post.key, Number(id))
  }
  // 标签颜色只给本次新建、仍是默认色的标签，博主调过的颜色不动。
  for (const [label, color] of Object.entries(SHOWCASE_TAG_COLORS))
    if (!existingTags.has(label)) await em.nativeUpdate(PostTag, { label, color: 'sky' }, { color })
  return ids
}
async function seedComments(
  em: EntityManager,
  ids: Map<string, number>,
  site: SiteSettings,
  progress: FixtureProgress,
  at: (days: number) => Date,
  now: Date,
) {
  const touched = new Set<number>()
  const create = (
    scenario: string,
    postId: number,
    author: string,
    content: string,
    owned: boolean,
    parentId: string | null,
    when: Date,
  ) =>
    ensureFixture(
      em,
      SHOWCASE_DATASET,
      scenario,
      'comment',
      async () => {
        const post = await em.findOne(Post, { id: postId, status: 'published', deletedAt: null })
        if (!post) return null
        const parent = parentId ? await em.findOne(Comment, { id: Number(parentId) }) : null
        if (parentId && !parent) return null
        // 访客不提供头像，前端按名字生成首字母头像；博主沿用站点头像
        const avatar = owned ? site.values.avatar : ''
        const value = em.create(Comment, {
          post,
          parent: parent ?? undefined,
          depth: parent ? parent.depth + 1 : 0,
          authorSnapshot: {
            name: owned ? site.values.ownerName : author,
            avatar,
            visitorIdHash: visitor(owned ? 'owner' : author),
          },
          content,
          isOwner: owned,
          status: 'published',
          likes: 0,
          createdAt: when,
        })
        await em.flush()
        await synchronizeMediaReferences(em, `comment:${value.id}`, 'comment', [avatar], { post, comment: value })
        touched.add(postId)
        return value.id
      },
      progress,
    )
  for (const post of SHOWCASE_POSTS) {
    const postId = ids.get(post.key)
    if (!postId) continue
    const published = at(post.days)
    for (const [index, item] of COMMENTS.get(post.key)!.entries()) {
      // 评论落在发布后一到三周内，但不晚于现在；回复再晚半天到两天。
      const offset = (1 + ((index * 5 + post.key.length) % 20)) * DAY + ((index * 7 + 3) % 11) * 3600000
      const when = new Date(Math.min(published.getTime() + offset, now.getTime() - 3600000))
      const root = await create(`${post.key}/${index}`, postId, item.author, item.content, false, null, when)
      if (item.reply && root) {
        const replyAt = new Date(
          Math.min(when.getTime() + (12 + ((index * 9) % 36)) * 3600000, now.getTime() - 1800000),
        )
        await create(`${post.key}/${index}/reply`, postId, item.author, item.reply, true, root, replyAt)
      }
    }
  }
  for (const postId of touched) {
    const post = await em.findOne(Post, { id: postId })
    if (post) post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
  }
  await em.flush()
}
async function seedPostLikes(
  em: EntityManager,
  ids: Map<string, number>,
  progress: FixtureProgress,
  at: (days: number) => Date,
  now: Date,
) {
  for (const post of SHOWCASE_POSTS) {
    const postId = ids.get(post.key)
    if (!postId) continue
    const entity = await em.findOne(Post, { id: postId, status: 'published', deletedAt: null })
    if (!entity) continue
    const published = at(post.days).getTime()
    const span = Math.max(now.getTime() - 3600000 - published, DAY)
    await ensureMany(
      em,
      'post-like',
      Array.from({ length: post.likes }, (_item, index) => `${post.key}/${index}`),
      (scenario) =>
        em.create(PostLike, {
          post: entity,
          visitorIdHash: visitor(`like/${scenario}`),
          // 点赞时间按序号在发布后到现在之间铺开，前期更密集。
          createdAt: new Date(
            published + Math.floor(span * Math.pow((Number(scenario.split('/').pop()) + 1) / (post.likes + 1), 1.6)),
          ),
        }),
      progress,
    )
    entity.likes = await em.count(PostLike, { post: entity })
  }
  await em.flush()
}
async function seedMoments(
  em: EntityManager,
  assets: Map<string, string>,
  postIds: Map<string, number>,
  site: SiteSettings,
  progress: FixtureProgress,
  at: (days: number) => Date,
  now: Date,
) {
  const moments = new MomentWriteService(em, new MomentReadService(em))
  for (const moment of SHOWCASE_MOMENTS) {
    const when = at(moment.days)
    const images = moment.images.map((name) => assets.get(name)).filter((id): id is string => !!id)
    const momentId = await ensureFixture(
      em,
      SHOWCASE_DATASET,
      moment.key,
      'moment',
      async () => {
        if (images.length !== moment.images.length) return null
        const linkedId = moment.linkedPost ? postIds.get(moment.linkedPost) : undefined
        const linked = linkedId ? await em.findOne(Post, { id: linkedId, status: 'published', deletedAt: null }) : null
        const saved = await moments.save(null, {
          content: moment.content,
          status: 'published',
          topics: [...moment.topics],
          images: images.map((id) => mediaUrl(id)),
          linkedArticleId: linked?.id ?? null,
          linkedLink: moment.linkedLink ?? null,
          requestId: randomUUID(),
          location: moment.location ?? null,
          device: moment.device ?? null,
          mood: moment.mood ?? null,
          isPinned: moment.pinned ?? false,
        })
        await em.nativeUpdate(Moment, { id: saved.id }, { createdAt: when, publishedAt: when })
        return saved.id
      },
      progress,
    )
    if (!momentId) continue
    for (const [index, comment] of moment.comments.entries())
      await ensureFixture(
        em,
        SHOWCASE_DATASET,
        `${moment.key}/${index}`,
        'moment-comment',
        async () => {
          const target = await em.findOne(Moment, { id: momentId, status: 'published', deletedAt: null })
          if (!target) return null
          const avatar = comment.owner ? site.values.avatar : ''
          const value = em.create(MomentComment, {
            moment: target,
            visitorIdHash: visitor(comment.owner ? 'owner' : comment.author),
            author: comment.owner ? site.values.ownerName : comment.author,
            avatar,
            content: comment.content,
            status: 'published',
            isOwner: !!comment.owner,
            createdAt: new Date(Math.min(when.getTime() + comment.hoursAfter * 3600000, now.getTime() - 1800000)),
          })
          await em.flush()
          await synchronizeMediaReferences(em, `moment-comment:${value.id}`, 'moment-comment', [avatar], {
            moment: target,
            momentComment: value,
          })
          return value.id
        },
        progress,
      )
    const target = await em.findOne(Moment, { id: momentId, status: 'published', deletedAt: null })
    if (!target) continue
    const span = Math.max(now.getTime() - 3600000 - when.getTime(), DAY)
    await ensureMany(
      em,
      'moment-like',
      Array.from({ length: moment.likes }, (_item, index) => `${moment.key}/${index}`),
      (scenario) =>
        em.create(MomentLike, {
          moment: target,
          visitorIdHash: visitor(`like/${scenario}`),
          createdAt: new Date(
            when.getTime() +
              Math.floor(span * Math.pow((Number(scenario.split('/').pop()) + 1) / (moment.likes + 1), 1.6)),
          ),
        }),
      progress,
    )
    target.likes = await em.count(MomentLike, { moment: target })
  }
  await em.flush()
}
async function seedGallery(
  em: EntityManager,
  assets: Map<string, string>,
  progress: FixtureProgress,
  at: (days: number) => Date,
) {
  const service = new GalleryService(em)
  for (const [index, [asset, title, category, description, location, device, days]] of GALLERY_PHOTOS.entries())
    await ensureFixture(
      em,
      SHOWCASE_DATASET,
      `photo-${asset}`,
      'gallery',
      async () => {
        const mediaId = assets.get(asset)
        if (!mediaId) return null
        return (
          await service.save(null, {
            requestId: randomUUID(),
            mediaId,
            title,
            description,
            category,
            takenOn: at(days).toISOString().slice(0, 10),
            location,
            device,
            sortOrder: index,
            status: 'published',
          })
        ).id
      },
      progress,
    )
}
async function seedGuestbook(em: EntityManager, progress: FixtureProgress) {
  await lockGuestbook(em)
  const service = new GuestbookWriteService(em, new GuestbookReadService(em))
  for (const [index, item] of TODAY_GUESTBOOK.entries()) {
    const id = await ensureFixture(
      em,
      SHOWCASE_DATASET,
      `today-${index}`,
      'guestbook',
      async () =>
        (
          await service.create(
            // 访客留言不带头像，前端按名字生成首字母头像
            { requestId: randomUUID(), content: item.content, author: item.author, avatar: '' },
            visitor(item.author),
            undefined,
            { browser: item.browser, region: item.region },
          )
        ).id,
      progress,
    )
    if (!id) continue
    if ('reply' in item)
      await ensureFixture(
        em,
        SHOWCASE_DATASET,
        `today-${index}/reply`,
        'guestbook',
        async () => {
          const parent = await em.findOne(GuestbookMessage, { id: Number(id), status: 'published', deletedAt: null })
          if (!parent) return null
          return (
            await service.create(
              { requestId: randomUUID(), content: item.reply, replyToId: parent.id },
              '',
              'fixture-owner',
            )
          ).id
        },
        progress,
      )
    for (const [person, emoji] of item.reactions.entries())
      await ensureFixture(
        em,
        SHOWCASE_DATASET,
        `today-${index}/${emoji}/${person}`,
        'guestbook-reaction',
        async () => {
          if (!(await em.findOne(GuestbookMessage, { id: Number(id), status: 'published', deletedAt: null })))
            return null
          const identity = visitor(`reaction/${index}/${person}`)
          await service.react(Number(id), identity, { emoji, reacted: true })
          return (await em.findOneOrFail(GuestbookReaction, { message: Number(id), visitorIdHash: identity, emoji })).id
        },
        progress,
      )
  }
}
export async function seedShowcaseFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const now = new Date()
  // 按天数派生固定但不规则的时分，避免所有内容堆在同一时刻。
  const at = (days: number) => {
    const value = new Date(now.getTime() - days * DAY)
    value.setHours(9 + ((days * 7) % 13), (days * 23) % 60, 0, 0)
    return value
  }
  const missing = (await readdir(CONTENT_DIR)).length
    ? SHOWCASE_POSTS.filter((post) => !COMMENTS.has(post.key))
    : SHOWCASE_POSTS
  if (missing.length) throw new Error(`正文目录不完整，缺少 ${missing.length} 篇：${missing[0]!.key}`)
  await ensureProfile(em, progress)
  const site = await em.findOneOrFail(SiteSettings, { id: 'default' }, { refresh: true })
  await syncOwnerSnapshots(em, site.values.ownerName)
  const assets = await ensureAssets(em, storage, progress, createdMedia)
  const postIds = await seedPosts(em, assets, progress, at)
  await seedComments(em, postIds, site, progress, at, now)
  await seedPostLikes(em, postIds, progress, at, now)
  await seedMoments(em, assets, postIds, site, progress, at, now)
  await seedGallery(em, assets, progress, at)
  await seedGuestbook(em, progress)
}
