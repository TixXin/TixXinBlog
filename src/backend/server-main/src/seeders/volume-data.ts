/** @file volume-data.ts @description 容量档开发数据：确定性批量生成与按批次整体清理，不进入代表样本的保护式归属流程 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { AuditEntry } from '../entities/audit-entry.entity'
import { Comment } from '../entities/comment.entity'
import { Post } from '../entities/post.entity'
import { SiteSettings } from '../entities/site-settings.entity'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { SavePostDto } from '../modules/post/dto/save-post.dto'
import { visibleCommentWhere } from '../modules/comment/comment-visibility'
import { withoutOwnerEvents } from '../modules/operations/owner-events'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import { DevelopmentDataError } from './seed-development-data'
import type { EntityManager } from '@mikro-orm/postgresql'
import { VOLUME_DATASET, VOLUME_HOT_COMMENTS, VOLUME_HOT_POSTS, VOLUME_MARK, VOLUME_SCALES } from './volume-constants'
import type { VolumeScale } from './volume-constants'

export { VOLUME_DATASET, VOLUME_MARK, VOLUME_SCALES } from './volume-constants'
export const VOLUME_DOMAINS = ['posts', 'comments'] as const
// 主题避开代表样本已经写过的那些，避免首页出现两篇同题文章。
const topics = [
  '日志采样',
  '灰度开关',
  '埋点口径',
  '重试策略',
  '幂等键',
  '连接池',
  '分页游标',
  '文件上传',
  '队列积压',
  '证书续期',
  '内存占用',
  '错误码',
  '代码评审',
  '监控告警',
  '版本号',
  '本地缓存',
  '周末的菜市场',
  '一场临时的会议',
  '楼下新开的店',
  '降温的那几天',
  '搬家前的清点',
  '傍晚的便利店',
  '连下三天的雨',
  '久违的午睡',
]
const facets = [
  '的取舍',
  '的边界条件',
  '的一次复盘',
  '里容易忽略的细节',
  '的几种做法',
  '带来的变化',
  '的准备工作',
  '之后的调整',
  '的记录',
  '的小结',
  '的成本',
  '的顺序',
  '的收尾',
]
// 生活类主题本身带「的」，后缀改用逗号接续，避免两个「的」连读。
const lifeFacets = ['，顺手记一笔', '，和那天的天气', '，没什么特别的', '，当时没多想', '，记下当时的想法']
const TECH_TOPICS = 16
const frames = [
  '把过程写下来',
  '留给以后的自己',
  '顺手整理成清单',
  '补上当时漏掉的判断',
  '对照之前的做法',
  '从一个具体例子说起',
  '先说结论再说原因',
  '按时间顺序回看',
  '只记有用的部分',
  '把疑问也写进来',
  '换个角度再想一遍',
  '把要点压到三条',
]
const voices = ['晨曦', '小林', '远山', '清和', '松间', '叙白', '南屿', '照野']
const followups = [
  '',
  '另外补充一点，实际做的时候顺序还可以再灵活些。',
  '我这边情况略有不同，不过结论是一致的。',
  '后来又遇到一次，按这个思路很快就定位到了。',
  '',
  '如果中间那步能再细说一点就更好了。',
  '顺手记在自己的笔记里了，以后好查。',
]
const remarks = [
  '读下来很有共鸣，尤其是中间那段取舍。',
  '这个顺序我之前没想过，回头试试看。',
  '补充一点：遇到同样的情况我是先看日志再回滚。',
  '写得很清楚，收藏了。',
  '最后那条结论对我帮助最大。',
  '想问下这种做法在数据量更大时还适用吗。',
  '同样的坑我也踩过，当时找了很久。',
  '看完去把自己的笔记也整理了一遍。',
  '这里的判断依据能再展开讲讲吗。',
  '谢谢分享，照着做之后确实快了不少。',
]
const visitor = (name: string, index: number) =>
  createHash('sha256').update(`development/${VOLUME_DATASET}/${name}/${index}`).digest('hex')
/** 同一序号始终得到同一篇内容，重复执行只补齐缺口。 */
export function volumeArticle(index: number) {
  // 主题与侧面合成一个序号再拆开，既走遍全部组合，相邻文章的后缀也不会连成一片。
  const pair = (index * 43) % (topics.length * facets.length)
  const topicIndex = pair % topics.length
  const technical = topicIndex < TECH_TOPICS
  const slot = Math.floor(pair / topics.length)
  const topic = topics[topicIndex]!,
    facet = technical ? facets[slot % facets.length]! : lifeFacets[slot % lifeFacets.length]!,
    frame = frames[(index * 5) % frames.length]!
  const title = `${topic}${facet}`
  // 摘要按序号在几种写法之间轮换，避免列表里连续几条长得一样。
  const summary = [
    `${frame}。重点在中间那段判断。`,
    `记一次关于${topic}的处理，包括当时排除掉的做法。`,
    `${topic}这件事本身不复杂，难的是把判断留下来。`,
    `${frame}，顺便把后来改掉的部分也补上。`,
    `从一个具体的例子说起，最后给出当时的结论。`,
  ][index % 5]!
  const body = `${summary}\n\n当时的处理顺序是先确认现象，再缩小范围，最后才动手改。中间有一次判断失误走了回头路，这部分也记在下面。\n\n回看时最有用的往往不是结论，而是当时为什么排除了另外几种做法。`
  return {
    title,
    summary,
    contentRaw: `# ${title}\n\n${body}`,
    folder: technical ? '前端开发' : '随笔日记',
    category: technical ? ('tech' as const) : ('life' as const),
    tags: [technical ? '技术分享' : '生活日常'],
    status: index % 40 === 0 ? ('draft' as const) : index % 40 === 1 ? ('archived' as const) : ('published' as const),
    // 浏览量带平方项，避免取模产生等差数列。
    views: 20 + ((index * index * 31 + index * 157 + 11) % 977),
  }
}
export function volumeComments(index: number) {
  // 每四篇中有一篇不带评论，其余按序号给出 1~3 条，并在其中穿插一层回复。
  const total = index % 4
  return Array.from({ length: total }, (_, position) => ({
    author: voices[(index + position) % voices.length]!,
    content: remarks[(index * 3 + position) % remarks.length]!,
    status:
      (index + position) % 10 === 3
        ? ('pending' as const)
        : (index + position) % 20 === 7
          ? ('hidden' as const)
          : ('published' as const),
    reply: position > 0 && (index + position) % 7 === 0,
  }))
}
function parse(args: string[]) {
  let scale: VolumeScale = 'small',
    clear = false,
    apply = false,
    confirm = ''
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--scale' && args[index + 1] && args[index + 1]! in VOLUME_SCALES)
      scale = args[++index] as VolumeScale
    else if (args[index] === '--clear' && !clear) clear = true
    else if (args[index] === '--apply' && !apply) apply = true
    else if (args[index] === '--confirm' && !confirm && args[index + 1]) confirm = args[++index]!
    else
      throw new DevelopmentDataError(
        `用法：db:dev volume [--scale ${Object.keys(VOLUME_SCALES).join('|')}] [--clear] [--apply --confirm 数据库名]`,
      )
  }
  if (clear && args.includes('--scale')) throw new DevelopmentDataError('清理整批容量数据，不接受 --scale')
  return { scale, clear, apply, confirm }
}
async function ownedIds(em: EntityManager, kind: string) {
  const rows = await em.execute<{ resource_id: string }[]>(
    'select resource_id from development_fixture where dataset=? and kind=? order by key',
    [VOLUME_DATASET, kind],
  )
  return rows.map((row) => row.resource_id)
}
async function ownedCount(em: EntityManager, pattern: string) {
  const [row] = await em.execute<{ n: number }[]>(
    'select count(*)::int as n from development_fixture where dataset=? and key like ?',
    [VOLUME_DATASET, pattern],
  )
  return row?.n ?? 0
}
async function record(em: EntityManager, rows: { key: string; kind: string; id: string }[]) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    await em.execute(
      `insert into development_fixture(key,dataset,kind,resource_id,snapshot_hash,created_at) values ${chunk
        .map(() => '(?,?,?,?,?,now())')
        .join(',')}`,
      chunk.flatMap((row) => [row.key, VOLUME_DATASET, row.kind, row.id, VOLUME_MARK]),
    )
  }
}
export async function runVolumeData(
  args: string[],
  write = (value: string) => process.stdout.write(value + '\n'),
  options: DevelopmentBackupOptions = {},
) {
  const { scale, clear, apply, confirm } = parse(args)
  const url = new URL(process.env.DATABASE_URL!),
    database = decodeURIComponent(url.pathname.slice(1))
  if (
    apply &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      process.env.NODE_ENV === 'production' ||
      confirm !== database ||
      ['postgres', 'template0', 'template1'].includes(database))
  )
    throw new DevelopmentDataError('只允许确认后的本机非生产开发数据库，未执行容量数据操作')
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: url.toString(),
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    const existingPosts = await ownedIds(orm.em.fork(), 'post')
    const existingComments = await ownedIds(orm.em.fork(), 'comment')
    const hotExisting = clear
      ? []
      : await Promise.all(
          VOLUME_HOT_POSTS.map((_, slot) => ownedCount(orm.em.fork(), `${VOLUME_DATASET}/comment/hot-${slot}-%`)),
        )
    const hotPending = clear
      ? 0
      : VOLUME_HOT_COMMENTS[scale].reduce((total, want, slot) => total + Math.max(0, want - hotExisting[slot]!), 0)
    const target = clear ? 0 : VOLUME_SCALES[scale]
    const plan = {
      dataset: VOLUME_DATASET,
      target: { database, host: url.hostname, port: Number(url.port || 5432) },
      action: clear ? 'clear' : 'seed',
      scale: clear ? null : scale,
      existing: { posts: existingPosts.length, comments: existingComments.length },
      pending: clear
        ? existingPosts.length + existingComments.length
        : Math.max(0, target - existingPosts.length) + hotPending,
      hot: clear
        ? null
        : VOLUME_HOT_POSTS.map((postIndex, slot) => ({
            post: postIndex,
            target: VOLUME_HOT_COMMENTS[scale][slot]!,
            existing: hotExisting[slot]!,
          })),
      scope: clear
        ? '按批次整体删除容量文章与评论及其归属记录；不触碰代表样本与用户内容'
        : `补齐到 ${target} 篇容量文章并按序号附带评论，另有三篇集中承载评论供分页查看；内容由固定词表确定性生成，重复执行只补缺口`,
      apply,
    }
    write(JSON.stringify(plan, null, 2))
    if (!apply) return { ...plan, preview: true, ready: false }
    if (
      (await orm.getMigrator().getPendingMigrations()).length ||
      (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
    )
      throw new DevelopmentDataError('请先核对并执行 migration:up，容量数据不会隐式迁移或重建数据库')
    const backup = await createDevelopmentBackup(options)
    write(`操作前完整备份：${backup.directory}`)
    let posts = 0,
      comments = 0
    await orm.em.fork().transactional(async (em) => {
      await em.execute("set local lock_timeout='15s'")
      await em.execute('select pg_advisory_xact_lock(742920)')
      if (clear) {
        for (const kind of ['comment', 'post'])
          await em.execute(
            `delete from public.${kind === 'comment' ? 'comment' : 'post'} where id::text in (select resource_id from development_fixture where dataset=? and kind=?)`,
            [VOLUME_DATASET, kind],
          )
        posts = existingPosts.length
        comments = existingComments.length
        await em.execute('delete from development_fixture where dataset=?', [VOLUME_DATASET])
      } else {
        await withoutOwnerEvents(async () => {
          const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
          const service = new AdminPostService(em, new PostRevisionsService(em))
          const owned: { key: string; kind: string; id: string }[] = []
          const now = Date.now()
          for (let index = existingPosts.length; index < target; index++) {
            const article = volumeArticle(index)
            const input = Object.assign(new SavePostDto(), article)
            const saved = await service.save(null, input, '容量档批量生成')
            const created = new Date(now - index * 86400000)
            // post.published_at 为非空列，草稿与归档沿用创建时间，由状态决定是否公开。
            await em.nativeUpdate(
              Post,
              { id: saved.id },
              { createdAt: created, publishedAt: created, views: article.views },
            )
            owned.push({ key: `${VOLUME_DATASET}/post/${index}`, kind: 'post', id: String(saved.id) })
            posts++
            if (article.status !== 'published') continue
            const post = em.getReference(Post, Number(saved.id))
            let parent: Comment | undefined
            for (const [position, entry] of volumeComments(index).entries()) {
              const value = em.create(Comment, {
                post,
                parent: entry.reply ? parent : undefined,
                depth: entry.reply && parent ? 1 : 0,
                authorSnapshot: {
                  name: entry.author,
                  avatar: site.values.avatar,
                  visitorIdHash: visitor(entry.author, index),
                },
                content: entry.content,
                isOwner: false,
                status: entry.status,
                likes: 0,
                createdAt: new Date(created.getTime() + (position + 1) * 3600000),
              })
              await em.flush()
              parent ??= value
              owned.push({
                key: `${VOLUME_DATASET}/comment/${index}-${position}`,
                kind: 'comment',
                id: String(value.id),
              })
              comments++
            }
            post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
          }
          // 评论分页需要集中承载：少数文章累积大量评论，并保留一层回复与待审状态。
          for (const [slot, postIndex] of VOLUME_HOT_POSTS.entries()) {
            const want = VOLUME_HOT_COMMENTS[scale][slot]!
            const key = `${VOLUME_DATASET}/post/${postIndex}`
            const postId =
              owned.find((row) => row.key === key)?.id ??
              (
                await em.execute<{ resource_id: string }[]>(
                  'select resource_id from development_fixture where dataset=? and key=?',
                  [VOLUME_DATASET, key],
                )
              )[0]?.resource_id
            if (!postId) continue
            const post = await em.findOne(Post, { id: Number(postId), status: 'published', deletedAt: null })
            if (!post) continue
            const have = await ownedCount(em, `${VOLUME_DATASET}/comment/hot-${slot}-%`)
            let root: Comment | undefined
            for (let position = have; position < want; position++) {
              const value = em.create(Comment, {
                post,
                parent: position % 6 === 5 ? root : undefined,
                depth: position % 6 === 5 && root ? 1 : 0,
                authorSnapshot: {
                  name: voices[position % voices.length]!,
                  avatar: site.values.avatar,
                  visitorIdHash: visitor(voices[position % voices.length]!, slot * 1000 + position),
                },
                content: remarks[position % remarks.length]! + followups[position % followups.length]!,
                isOwner: false,
                status: position % 17 === 9 ? 'pending' : position % 29 === 13 ? 'hidden' : 'published',
                likes: 0,
                createdAt: new Date(post.createdAt.getTime() + (position + 1) * 600000),
              })
              await em.flush()
              if (position % 6 === 0) root = value
              owned.push({
                key: `${VOLUME_DATASET}/comment/hot-${slot}-${position}`,
                kind: 'comment',
                id: String(value.id),
              })
              comments++
            }
            post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
          }
          await em.flush()
          await record(em, owned)
        })
      }
      await em.execute(
        "update post_tag set count=(select count(*) from post_tag_map m join post p on p.id=m.post_id where m.post_tag_id=post_tag.id and p.status='published' and p.deleted_at is null)",
      )
      await em.execute('update content_context set generation=?,require_context=true', [randomUUID()])
      em.create(AuditEntry, {
        action: clear ? 'development.volume-clear' : 'development.volume-seed',
        resourceType: 'dataset',
        resourceId: VOLUME_DATASET,
        actorName: '本机开发工具',
        state: 'success',
        summary: { fields: [], counts: { posts, comments } },
        finishedAt: new Date(),
      })
      await em.flush()
    })
    const report = { ...plan, preview: false, backup: backup.directory, ready: true, posts, comments }
    write(JSON.stringify(report, null, 2))
    return report
  } finally {
    await orm.close(true)
  }
}
