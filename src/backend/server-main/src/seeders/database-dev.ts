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
import { createFullBackup } from '../../scripts/full-backup.mjs'

const actions = ['status', 'seed-moments', 'remove-samples', 'clear-moments', 'clear-content', 'reset'] as const
type Action = (typeof actions)[number]
class DevDatabaseError extends Error {}
const seedId = (id: string) => `dev-moment-v1-${id}`
const sampleIds = mockMoments.map((note) => seedId(note.id))
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
async function requireIdle(em: EntityManager, application: string) {
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
export async function runDevDatabase(args: string[], write = (text: string) => process.stdout.write(text + '\n')) {
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
    const removable = known.filter((note) => note.revision === 0 && note.content.startsWith('[开发示例]'))
    const scope = {
      status: '只读统计，不创建或修改数据库',
      'seed-moments': '追加带开发示例标记的动态与示例评论；点赞从零开始，已有内容不覆盖',
      'remove-samples': '仅删除未编辑的开发动态及其互动；已编辑样本保留',
      'clear-moments': '清空全部朋友圈正文、互动及提交记录；保留其他业务、账号、站点和媒体文件',
      'clear-content': '清空文章、闪念、朋友圈、评论、目录和导入票据；保留账号、站点、审核设置、媒体和审计',
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
    if (input.action !== 'seed-moments') await requireIdle(orm.em.fork(), application)
    // 备份使用已有一致快照/媒体流程；失败时不执行后续写入。
    const backup = await createFullBackup()
    write(`写入前完整备份：${backup.directory}`)
    if (input.action !== 'seed-moments') await requireIdle(orm.em.fork(), application)
    await orm.em.fork().transactional(async (em) => {
      await em.execute("set local lock_timeout='5s'")
      if (input.action !== 'seed-moments') {
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
          const date = new Date(sample.date)
          const postId = Number(sample.linkedArticle?.id)
          const linkedArticle =
            Number.isInteger(postId) && postId > 0
              ? await em.findOne(Post, { id: postId, status: 'published', deletedAt: null })
              : null
          const values = momentValues({
            content: `[开发示例] ${sample.content}`,
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
              createdAt: new Date(date.getTime() + (index + 1) * 60000),
            })
            await em.flush()
            await synchronizeMediaReferences(em, `moment-comment:${created.id}`, 'moment-comment', [created.avatar], {
              moment: note,
              momentComment: created,
            })
          }
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
            id: { $in: removable.map((note) => note.id) },
            revision: 0,
            content: { $like: '[开发示例]%' },
          })
        else await em.nativeDelete(Moment, {})
        if (input.action === 'clear-content') {
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
        summary: { fields: [], counts: { samples: input.action === 'seed-moments' ? add.length : removable.length } },
        finishedAt: new Date(),
      })
      await em.flush()
    })
    write('操作完成。媒体文件未从磁盘删除；重新启动服务并刷新页面后使用新的内容上下文。')
    return { ...plan, backup: backup.directory, after: await counts(orm) }
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
