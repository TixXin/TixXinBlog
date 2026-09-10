/** @file database-dev.ts @description 显式本机开发数据工具；默认只预览，写入先备份，清空仅在服务停止后进行 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { Moment } from '../entities/moment.entity'
import { MomentComment } from '../entities/moment-comment.entity'
import { Post } from '../entities/post.entity'
import { SiteSettings } from '../entities/site-settings.entity'
import { AuditEntry } from '../entities/audit-entry.entity'
import { lockMedia, synchronizeMediaReferences } from '../modules/media/media-references'
import { momentValues, momentUrl } from '../modules/moment/moment-values'
import { mockMoments } from '../../../../frontend/web-blog/app/features/moment/mock'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'

const actions = [
  'status',
  'seed-moments',
  'normalize-samples',
  'remove-samples',
  'clear-moments',
  'clear-content',
  'reset',
] as const
type Action = (typeof actions)[number]
class DevDatabaseError extends Error {}
const seedId = (id: string) => `dev-moment-v1-${id}`
const sampleIds = mockMoments.map((note) => seedId(note.id))
// 开发身份仅保留在稳定编号中；兼容旧工具曾写入正文的前缀。
const legacyPrefix = '[开发示例]'
const sampleContents = new Map(mockMoments.map((note) => [seedId(note.id), note.content]))
const normalizeSampleContent = (content: string) => content.replace(/^\[开发示例\] ?/, '')
const isUneditedSample = (note: Moment) =>
  note.revision === 0 &&
  (note.content === sampleContents.get(note.id) || note.content === `${legacyPrefix} ${sampleContents.get(note.id)}`)
async function hasOnlyOriginalInteractions(em: EntityManager, note: Moment, site: SiteSettings) {
  const sample = mockMoments.find((item) => seedId(item.id) === note.id)!
  const [likes] = await em.execute<{ count: number }[]>(
    'select count(*)::int as count from moment_like where moment_id=?',
    [note.id],
  )
  if (likes?.count) return false
  const comments = await em.find(MomentComment, { moment: note.id })
  if (comments.length !== (sample.comments ?? []).length) return false
  return (sample.comments ?? []).every((original, index) => {
    const visitor = createHash('sha256').update(`development:${note.id}:${index}`).digest('hex')
    const current = comments.find((item) => item.visitorIdHash === visitor)
    return (
      current &&
      !current.deletedAt &&
      current.status === 'published' &&
      current.content === original.content &&
      current.isOwner === !!original.isOwner &&
      current.author === (original.isOwner ? site.values.ownerName : original.author) &&
      current.avatar === (original.isOwner ? site.values.avatar : momentUrl(original.avatar || '', true, true))
    )
  })
}
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
function options(args: string[]) {
  const action = (args[0] ?? 'status') as Action
  if (!actions.includes(action))
    throw new DevDatabaseError(`用法：db:dev ${actions.join(' | ')} [--apply --confirm 数据库名]`)
  let apply = false,
    confirm = ''
  for (let index = 1; index < args.length; index++) {
    if (args[index] === '--apply' && !apply) apply = true
    else if (args[index] === '--confirm' && !confirm && args[index + 1]) confirm = args[++index]!
    else throw new DevDatabaseError('不支持的参数；写入需要 --apply --confirm 数据库名')
  }
  if (action === 'status' && (apply || confirm)) throw new DevDatabaseError('status 只读，不接受写入参数')
  return { action, apply, confirm }
}
export async function requireIdle(em: EntityManager, application: string) {
  const [row] = await em.execute<{ count: number }[]>(
    "select count(*)::int as count from pg_stat_activity where datname=current_database() and application_name<>? and backend_type='client backend'",
    [application],
  )
  if (row?.count)
    throw new DevDatabaseError(
      '数据库仍有其他连接。请先正常退出本项目后端和数据库客户端，再执行清空；工具不会停止已有进程。',
    )
}
async function counts(orm: MikroORM) {
  const tables = await orm.em
    .getConnection()
    .execute<{ tablename: string }[]>("select tablename from pg_tables where schemaname='public' order by tablename")
  const result: Record<string, number> = {}
  for (const { tablename } of tables) {
    const [row] = await orm.em
      .getConnection()
      .execute<{ count: number }[]>(`select count(*)::int as count from public.${quote(tablename)}`)
    result[tablename] = row!.count
  }
  return result
}
export async function runDevDatabase(
  args: string[],
  write = (text: string) => process.stdout.write(text + '\n'),
  backupOptions: DevelopmentBackupOptions = {},
) {
  const input = options(args)
  const url = new URL(process.env.DATABASE_URL!)
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    input.apply &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || process.env.NODE_ENV === 'production')
  )
    throw new DevDatabaseError('写入仅允许本机非生产开发数据库。')
  if (
    input.apply &&
    (input.confirm !== database ||
      !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(database) ||
      ['postgres', 'template0', 'template1'].includes(database))
  )
    throw new DevDatabaseError('目标数据库确认不匹配，未执行写入。请先查看预览，再使用完整数据库名确认。')
  const application = `tixxin-dev-data-${randomUUID()}`
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: url.toString(),
    pool: { min: 0, max: 2 },
    driverOptions: { connection: { application_name: application } },
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    const before = await counts(orm)
    const pending =
      'mikro_orm_migrations' in before ? await orm.getMigrator().getPendingMigrations() : [{ name: '数据库尚未初始化' }]
    const known = 'moment' in before ? await orm.em.fork().find(Moment, { id: { $in: sampleIds } }) : []
    const add = sampleIds.filter((id) => !known.some((note) => note.id === id))
    const removable: Moment[] = []
    const protectionSite = known.length ? await orm.em.fork().findOneOrFail(SiteSettings, { id: 'default' }) : null
    for (const note of known.filter(isUneditedSample))
      if (protectionSite && (await hasOnlyOriginalInteractions(orm.em.fork(), note, protectionSite)))
        removable.push(note)
    const normalizable = known.filter((note) => note.content.startsWith(legacyPrefix))
    const requiresIdle = input.action !== 'seed-moments' && input.action !== 'normalize-samples'
    // 首次导入按今日 UTC 平移整组日期，保留样本间隔；避免旧固定日期令当前月日历一直为空。
    const sourceDates = mockMoments.map((note) => Date.parse(note.date))
    if (sourceDates.some((date) => !Number.isFinite(date)))
      throw new DevDatabaseError('开发样本包含无效日期，未写入数据。')
    const today = new Date()
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const dateOffset = todayStart - Math.max(...sourceDates)
    const scope = {
      status: '只读统计，不创建或修改数据库',
      'seed-moments': '追加自然正文的动态与评论，以内部稳定编号识别样本；点赞从零开始，已有内容不覆盖',
      'normalize-samples': '仅去除已知朋友圈样本正文开头的旧开发标记；保留其他正文、字段、日期和互动',
      'remove-samples': '仅删除未编辑且互动仍为原始样本的开发动态；有新增、编辑或删除互动的内容保留',
      'clear-moments': '清空全部朋友圈正文、互动及提交记录；保留其他业务、账号、站点和媒体文件',
      'clear-content':
        '清空文章、闪念、朋友圈、留言、图库、项目、友链、评论、目录和导入票据；保留账号、站点、审核与规则设置、媒体、样本归属账本和审计',
      reset:
        '重建全部应用表，账号、配置、内容和媒体索引全部删除；迁移生成默认配置，磁盘媒体和备份保留，需要重新创建管理员',
    }[input.action]
    const plan = {
      action: input.action,
      scope,
      target: { host: url.hostname, port: Number(url.port || 5432), database },
      pendingMigrations: pending.length,
      counts: before,
      samplesToAdd: add.length,
      samplesToNormalize: normalizable.length,
      sampleDateRange: {
        from: new Date(Math.min(...sourceDates) + dateOffset).toISOString(),
        to: new Date(todayStart).toISOString(),
        appliesTo: '仅首次插入的样本，已有记录的日期不变',
      },
      samplesToRemove: removable.length,
      editedSamplesPreserved: known.length - removable.length,
      apply: input.apply,
    }
    write(JSON.stringify(plan, null, 2))
    if (!input.apply || input.action === 'status') {
      if (input.action !== 'status')
        write(`仅预览。确认后执行：corepack pnpm db:dev ${input.action} --apply --confirm ${database}`)
      return plan
    }
    if (pending.length)
      throw new DevDatabaseError('存在待应用迁移。请先执行 migration:up；数据工具不会自动迁移已有数据库。')
    if ((await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim())
      throw new DevDatabaseError('数据库结构与实体不一致，请先解决迁移漂移。')
    if (input.action === 'seed-moments' && !add.length) {
      write('开发样本均已存在，未覆盖内容。')
      return plan
    }
    if (input.action === 'remove-samples' && !removable.length) {
      write('没有可清理的未编辑开发样本。')
      return plan
    }
    if (input.action === 'normalize-samples' && !normalizable.length) {
      write('已知样本没有需要去除的旧正文标记。')
      return plan
    }
    if (requiresIdle) await requireIdle(orm.em.fork(), application)
    // 备份使用已有一致快照/媒体流程；失败时不执行后续写入。
    const backup = await createDevelopmentBackup(backupOptions)
    write(`写入前完整备份：${backup.directory}`)
    if (requiresIdle) await requireIdle(orm.em.fork(), application)
    let samplesNormalized = 0
    await orm.em.fork().transactional(async (em) => {
      await em.execute("set local lock_timeout='5s'")
      if (requiresIdle) {
        const tables = Object.keys(before)
        await em.execute(
          `lock table ${tables.map((name) => `public.${quote(name)}`).join(',')} in access exclusive mode nowait`,
        )
        await requireIdle(em, application)
      }
      await lockMedia(em)
      if (input.action === 'seed-moments') {
        const site = await em.findOneOrFail(SiteSettings, { id: 'default' })
        for (const sample of mockMoments) {
          const id = seedId(sample.id)
          if (await em.findOne(Moment, { id })) continue
          const date = new Date(Date.parse(sample.date) + dateOffset)
          const postId = Number(sample.linkedArticle?.id)
          const linkedArticle =
            Number.isInteger(postId) && postId > 0
              ? await em.findOne(Post, { id: postId, status: 'published', deletedAt: null })
              : null
          const values = momentValues({
            content: sample.content,
            topics: sample.topics ?? [],
            images: sample.images ?? [],
            location: sample.location,
            device: sample.device,
            mood: sample.mood,
            linkedLink: linkedArticle ? null : (sample.linkedLink ?? null),
            isPinned: !!sample.isPinned,
          })
          const note = em.create(Moment, {
            ...values,
            id,
            content: values.content!,
            status: 'published',
            linkedArticle,
            publishedAt: date,
            createdAt: date,
          })
          await em.flush()
          await synchronizeMediaReferences(em, `moment:${id}`, 'moment', [note.content, note.images, note.linkedLink], {
            moment: note,
          })
          for (const [index, comment] of (sample.comments ?? []).entries()) {
            const created = em.create(MomentComment, {
              moment: note,
              content: comment.content,
              author: comment.isOwner ? site.values.ownerName : comment.author,
              avatar: comment.isOwner ? site.values.avatar : momentUrl(comment.avatar || '', true, true),
              isOwner: !!comment.isOwner,
              visitorIdHash: createHash('sha256').update(`development:${id}:${index}`).digest('hex'),
              status: 'published',
              createdAt: new Date(Math.min(today.getTime(), date.getTime() + (index + 1) * 60000)),
            })
            await em.flush()
            await synchronizeMediaReferences(em, `moment-comment:${created.id}`, 'moment-comment', [created.avatar], {
              moment: note,
              momentComment: created,
            })
          }
        }
      } else if (input.action === 'normalize-samples') {
        for (const note of normalizable) {
          // 比较正文与修订号后只更新前缀，备份期间发生的人工编辑会被跳过。
          // 使用定点 SQL，避免 ORM 的 onUpdate 改写日期，也不影响媒体引用与互动。
          const changed = await em.execute<{ id: string }[]>(
            'update moment set content=? where id=? and content=? and revision=? returning id',
            [normalizeSampleContent(note.content), note.id, note.content, note.revision],
          )
          samplesNormalized += changed.length
        }
      } else if (input.action === 'reset') {
        // 初始迁移不可逆；一次性删除全部已核对的应用表，再在同一事务中重放迁移。
        // 不使用 CASCADE，其他 schema/视图对这些表的依赖会阻止重建并整体回滚。
        const transaction = em.getTransactionContext()
        const migrator = orm.getMigrator()
        const tables = Object.keys(before).filter((name) => name !== 'mikro_orm_migrations')
        await em.execute(`drop table ${tables.map((name) => `public.${quote(name)}`).join(',')}`)
        const enums = new Set(
          Object.values(orm.getMetadata().getAll()).flatMap((meta) =>
            Object.values(meta.properties)
              .map((property) => property.nativeEnumName)
              .filter((name): name is string => !!name),
          ),
        )
        for (const name of enums) await em.execute(`drop type public.${quote(name)}`)
        await em.execute('delete from mikro_orm_migrations')
        // 迁移入口在事务外读取系统目录，因此连接池保留第二条本工具连接；实际 DDL 共用此事务。
        await migrator.up({ transaction })
        await em.execute('update content_context set generation=?,require_context=true', [randomUUID()])
      } else {
        if (input.action === 'remove-samples')
          await em.nativeDelete(Moment, {
            $or: removable.map((note) => ({ id: note.id, content: note.content })),
            revision: 0,
          })
        else await em.nativeDelete(Moment, {})
        if (input.action === 'clear-content') {
          await em.execute('delete from gallery_photo')
          await em.execute('delete from project')
          await em.execute('delete from friend_link')
          await em.execute('delete from guestbook_message')
          await em.execute('delete from flash_note')
          await em.execute('delete from post')
          for (const table of ['post_tag', 'post_folder', 'taxonomy_alias', 'post_batch_operation', 'content_import'])
            await em.execute(`delete from ${quote(table)}`)
        }
        await em.execute('update content_context set generation=?,require_context=true', [randomUUID()])
      }
      em.create(AuditEntry, {
        action: `development.${input.action}`,
        resourceType: 'database',
        actorName: '本机开发工具',
        state: 'success',
        summary: {
          fields: [],
          counts: {
            samples:
              input.action === 'seed-moments'
                ? add.length
                : input.action === 'normalize-samples'
                  ? samplesNormalized
                  : removable.length,
          },
        },
        finishedAt: new Date(),
      })
      await em.flush()
    })
    if (input.action === 'normalize-samples')
      write(`已去除 ${samplesNormalized} 条正文标记，跳过 ${normalizable.length - samplesNormalized} 条并发变化记录。`)
    else write('操作完成。媒体文件未从磁盘删除；重新启动服务并刷新页面后使用新的内容上下文。')
    return { ...plan, samplesNormalized, backup: backup.directory, after: await counts(orm) }
  } finally {
    await orm.close(true)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void runDevDatabase(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      (error instanceof DevDatabaseError
        ? error.message
        : '数据库操作未完成，请检查连接、备份权限和迁移状态；未自动重试写入。') + '\n',
    )
    process.exitCode = 1
  })
