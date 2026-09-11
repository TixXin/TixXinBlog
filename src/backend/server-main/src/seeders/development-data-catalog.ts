/** @file development-data-catalog.ts @description 日常开发数据覆盖目录；只读统计真实可见内容，不把页面存在当作业务完成 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { visibleCommentSql } from '../modules/comment/comment-visibility'
import { ConfigService } from '@nestjs/config'
import { LocalMediaStorage } from '../modules/media/media-storage'
import { fixtureHash, FIXTURE_TABLES } from './fixture-ledger'
import type { FixtureKind } from './fixture-ledger'

type Counts = Record<string, number>
interface Domain {
  id: string
  entry: string
  admin: string
  table: string
  searchColumn?: string
  query: string
  required: Record<string, number>
  dataset?: string
  source?: string
  scenarios?: string
}
const publicPost = "p.status='published' and p.deleted_at is null"
export const DATA_DOMAINS: Domain[] = [
  {
    id: 'writing',
    entry: '/archive',
    admin: '/admin/posts',
    table: 'post',
    searchColumn: 'title',
    dataset: 'writing-v1',
    source: 'PostgreSQL 真实文章、项目、图库与媒体；writing-v1归属',
    scenarios: '万字长文、草稿、有序跨域关联、带来源的素材说明',
    query: `select count(*)::int as total,count(*) filter(where p.status='published' and p.deleted_at is null and length(p.content_raw)>10000)::int as "longArticles",count(*) filter(where p.status='draft' and p.deleted_at is null)::int as drafts,count(*) filter(where jsonb_array_length(p.related_content)>0 and p.deleted_at is null)::int as linked from post p join development_fixture f on f.resource_id=p.id::text and f.kind='post' where f.dataset='writing-v1'`,
    required: { longArticles: 1, drafts: 1, linked: 2 },
  },
  {
    id: 'notifications',
    entry: '/admin/notifications',
    admin: '/admin/operations',
    table: 'owner_notification',
    dataset: 'notifications-v1',
    source: 'PostgreSQL 真实事件与当前业务状态；通知已读不代表业务处理',
    scenarios: '通知分页、未读与已读、待审/待回复/已回复/隐藏，暂停投递任务',
    query: `select count(*)::int as total,count(*) filter(where read_at is null)::int as unread,count(*) filter(where read_at is not null)::int as "read",count(*) filter(where created_at>=now()-interval '30 days')::int as recent,(select count(*)::int from background_task where kind='mail' and state='paused') as "pausedMail" from owner_notification`,
    required: { total: 21, unread: 1, read: 1, recent: 1, pausedMail: 1 },
  },
  {
    id: 'posts',
    entry: '/',
    admin: '/admin/posts',
    table: 'post',
    searchColumn: 'title',
    query: `select count(*)::int as total,count(*) filter(where status='published' and deleted_at is null)::int as published,count(*) filter(where status='draft' and deleted_at is null)::int as drafts,count(*) filter(where status='archived' and deleted_at is null)::int as archived,count(*) filter(where status='published' and deleted_at is null and published_at>=now()-interval '30 days')::int as recent,count(*) filter(where cover is not null and cover<>'' and deleted_at is null)::int as images from post`,
    required: { published: 16, drafts: 1, archived: 1, recent: 1, images: 1 },
  },
  {
    id: 'comments',
    entry: '/articles/:id',
    admin: '/admin/comments',
    table: 'comment',
    searchColumn: 'content',
    query: `select count(*)::int as total,count(*) filter(where ${publicPost} and ${visibleCommentSql('c')})::int as published,count(*) filter(where c.status='pending')::int as pending,count(*) filter(where c.status='hidden')::int as hidden,count(*) filter(where c.parent_id is not null)::int as replies,count(*) filter(where c.is_owner)::int as owner from comment c join post p on p.id=c.post_id`,
    required: { published: 2, pending: 1, hidden: 1, replies: 1, owner: 1 },
  },
  {
    id: 'flashes',
    entry: '/flash',
    admin: '/admin/flashes',
    table: 'flash_note',
    searchColumn: 'content',
    query: `select count(*)::int as total,count(*) filter(where not is_draft and not is_archived)::int as published,count(*) filter(where is_draft and not is_archived)::int as drafts,count(*) filter(where is_archived)::int as archived,count(*) filter(where not is_draft and not is_archived and created_at>=now()-interval '30 days')::int as recent,count(*) filter(where jsonb_array_length(images)>0)::int as images from flash_note where user_id='tixxin'`,
    required: { published: 16, drafts: 1, archived: 1, recent: 1, images: 1 },
  },
  {
    id: 'moments',
    entry: '/moments',
    admin: '/admin/moments',
    table: 'moment',
    searchColumn: 'content',
    query: `select count(*)::int as total,count(*) filter(where status='published' and deleted_at is null)::int as published,count(*) filter(where status='draft' and deleted_at is null)::int as drafts,count(*) filter(where status='archived' and deleted_at is null)::int as archived,count(*) filter(where status='published' and deleted_at is null and published_at>=now()-interval '30 days')::int as recent,count(*) filter(where jsonb_array_length(images)>0 and deleted_at is null)::int as images from moment`,
    required: { published: 16, drafts: 1, archived: 1, recent: 1, images: 1 },
  },
  {
    id: 'gallery',
    entry: '/gallery',
    admin: '/admin/gallery',
    table: 'gallery_photo',
    searchColumn: 'title',
    dataset: 'gallery-v1',
    source: 'PostgreSQL gallery_photo、media_asset、media_reference；MEDIA_DIRECTORY 本地文件及外链 URL',
    scenarios: '两页公开作品、草稿撤回、分类排序、长短说明、缺省字段、横竖比例、近期历史拍摄日期及共用图片',
    query: `select count(*)::int as total,
      count(*) filter(where g.status='published' and g.deleted_at is null)::int as published,
      count(*) filter(where g.status='draft' and g.deleted_at is null)::int as drafts,
      count(*) filter(where g.status='withdrawn' and g.deleted_at is null)::int as withdrawn,
      count(distinct nullif(g.category,'')) filter(where g.status='published' and g.deleted_at is null)::int as categories,
      count(*) filter(where g.status='published' and g.deleted_at is null and g.taken_on>=current_date-30)::int as recent,
      count(*) filter(where g.status='published' and g.deleted_at is null and g.taken_on<current_date-365)::int as historical,
      count(*) filter(where g.deleted_at is null and g.taken_on is null)::int as undated,
      count(*) filter(where g.deleted_at is null and g.sort_order<>0)::int as ordered,
      count(*) filter(where g.deleted_at is null and length(g.description)>100)::int as "longText",
      count(*) filter(where g.deleted_at is null and g.description='')::int as "emptyDescription",
      count(*) filter(where g.status='published' and g.deleted_at is null and m.width>m.height)::int as landscape,
      count(*) filter(where g.status='published' and g.deleted_at is null and m.width<m.height)::int as portrait,
      count(distinct g.media_id) filter(where g.deleted_at is null and m.deleted_at is null)::int as images,
      count(*) filter(where g.deleted_at is null and exists(select 1 from media_reference r where r.gallery_photo_id=g.id and r.asset_id=g.media_id))::int as references,
      count(*) filter(where g.deleted_at is null and g.external_url is not null)::int as external,
      count(*) filter(where g.status='published' and g.deleted_at is null and g.external_url is not null)::int as "externalPublished"
      from gallery_photo g left join media_asset m on m.id=g.media_id`,
    required: {
      published: 13,
      drafts: 1,
      withdrawn: 1,
      categories: 3,
      recent: 1,
      historical: 1,
      undated: 1,
      ordered: 1,
      longText: 1,
      emptyDescription: 1,
      landscape: 1,
      portrait: 1,
      images: 4,
      references: 18,
    },
  },
  {
    id: 'gallery-external',
    entry: '/gallery',
    admin: '/admin/gallery',
    table: 'gallery_photo',
    dataset: 'gallery-external-v1',
    source: 'PostgreSQL gallery_photo.external_url；浏览器直连外链，检查工具不抓取远程图片',
    scenarios: '外链横竖构图、查询参数、未知尺寸、缺省资料、公开草稿撤回',
    query: `select count(*)::int as total,
      count(*) filter(where status='published')::int as published,
      count(*) filter(where status='draft')::int as drafts,
      count(*) filter(where status='withdrawn')::int as withdrawn,
      count(*) filter(where external_url like '%?%')::int as parameterized
      from gallery_photo where deleted_at is null and external_url is not null`,
    required: { total: 4, published: 2, drafts: 1, withdrawn: 1, parameterized: 1 },
  },
  {
    id: 'projects',
    entry: '/projects',
    admin: '/admin/projects',
    table: 'project',
    searchColumn: 'title',
    dataset: 'project-v1',
    source: 'PostgreSQL project、media_asset、media_reference；MEDIA_DIRECTORY 本地封面',
    scenarios: '两页公开项目、草稿撤回、三种独立项目进展、排序、多技术标签、有无封面、有无链接和长短说明',
    query: `select count(*)::int as total,
      count(*) filter(where p.status='published' and p.deleted_at is null)::int as published,
      count(*) filter(where p.status='draft' and p.deleted_at is null)::int as drafts,
      count(*) filter(where p.status='withdrawn' and p.deleted_at is null)::int as withdrawn,
      count(*) filter(where p.status='published' and p.deleted_at is null and p.progress='active')::int as active,
      count(*) filter(where p.status='published' and p.deleted_at is null and p.progress='dev')::int as developing,
      count(*) filter(where p.status='published' and p.deleted_at is null and p.progress='archived')::int as archived,
      count(*) filter(where p.deleted_at is null and p.cover_media_id is not null)::int as covered,
      count(*) filter(where p.status='published' and p.deleted_at is null and p.cover_media_id is null)::int as "withoutCover",
      count(distinct p.cover_media_id) filter(where p.deleted_at is null)::int as images,
      count(*) filter(where p.deleted_at is null and p.sort_order<>0)::int as ordered,
      count(*) filter(where p.deleted_at is null and length(p.description)>100)::int as "longText",
      count(*) filter(where p.deleted_at is null and jsonb_array_length(p.tags)>1)::int as "multipleTags",
      count(*) filter(where p.deleted_at is null and jsonb_array_length(p.links)>0)::int as linked,
      count(*) filter(where p.status='published' and p.deleted_at is null and jsonb_array_length(p.links)=0)::int as "withoutLinks",
      (select count(distinct lower(tag->>'label'))::int from project t cross join lateral jsonb_array_elements(t.tags) tag where t.status='published' and t.deleted_at is null) as tags,
      count(*) filter(where p.deleted_at is null and p.cover_media_id is not null and exists(select 1 from media_reference r where r.project_id=p.id and r.asset_id=p.cover_media_id and r.kind='project'))::int as references
      from project p`,
    required: {
      published: 13,
      drafts: 1,
      withdrawn: 1,
      active: 1,
      developing: 1,
      archived: 1,
      covered: 1,
      withoutCover: 1,
      images: 3,
      ordered: 1,
      longText: 1,
      multipleTags: 1,
      linked: 1,
      withoutLinks: 1,
      tags: 3,
      references: 1,
    },
  },
  {
    id: 'links',
    entry: '/links',
    admin: '/admin/links',
    table: 'friend_link',
    searchColumn: 'name',
    dataset: 'link-v1',
    source: 'PostgreSQL friend_link、link_settings、media_asset、media_reference；本地或明确外部 HTTPS 标志',
    scenarios: '两页公开友链、草稿撤回、推荐排序、长短介绍、无图、受管标志、外部标志、同域不同路径与地址冲突',
    query: `select count(*)::int as total,
      count(*) filter(where status='published' and deleted_at is null)::int as published,
      count(*) filter(where status='draft' and deleted_at is null)::int as drafts,
      count(*) filter(where status='withdrawn' and deleted_at is null)::int as withdrawn,
      count(*) filter(where status='published' and deleted_at is null and is_featured)::int as featured,
      count(*) filter(where status='published' and deleted_at is null and not is_featured)::int as regular,
      count(distinct substring(url from '^https?://([^/]+)')) filter(where status='published' and deleted_at is null)::int as domains,
      count(*) filter(where deleted_at is null and sort_order<>0)::int as ordered,
      count(*) filter(where deleted_at is null and length(description)>100)::int as "longText",
      count(*) filter(where deleted_at is null and logo_media_id is not null)::int as managed,
      count(*) filter(where status='published' and deleted_at is null and logo_url is not null)::int as external,
      count(*) filter(where status='published' and deleted_at is null and logo_media_id is null and logo_url is null)::int as "withoutImage",
      count(distinct logo_media_id) filter(where deleted_at is null)::int as images,
      count(*) filter(where deleted_at is null and logo_media_id is not null and exists(select 1 from media_reference r where r.friend_link_id=friend_link.id and r.asset_id=friend_link.logo_media_id and r.kind='link'))::int as references
      from friend_link`,
    required: {
      published: 13,
      drafts: 1,
      withdrawn: 1,
      featured: 1,
      regular: 1,
      domains: 3,
      ordered: 1,
      longText: 1,
      managed: 3,
      external: 1,
      withoutImage: 1,
      images: 3,
      references: 3,
    },
  },
  {
    id: 'media',
    entry: '/api/v1/media/:key',
    admin: '/admin/media',
    table: 'media_asset',
    query: `select count(*)::int as total,count(*) filter(where deleted_at is null)::int as active from media_asset`,
    required: { active: 1 },
  },
  {
    id: 'site',
    entry: '/api/v1/site',
    admin: '/admin/site',
    table: 'site_settings',
    query: `select count(*)::int as total,count(*) filter(where id='default' and length("values"->>'ownerName')>0 and length("values"->>'name')>0)::int as configured from site_settings`,
    required: { configured: 1 },
  },
  {
    id: 'guestbook',
    entry: '/guestbook',
    admin: '/admin/guestbook',
    table: 'guestbook_message',
    searchColumn: 'content',
    query: `select count(*)::int as total,count(*) filter(where status='published' and deleted_at is null)::int as published,count(*) filter(where status='pending' and deleted_at is null)::int as pending,count(*) filter(where status='hidden' and deleted_at is null)::int as hidden,count(*) filter(where reply_to_id is not null and deleted_at is null)::int as replies,count(*) filter(where is_owner and deleted_at is null)::int as owner,count(*) filter(where is_pinned and status='published' and deleted_at is null)::int as pinned,count(*) filter(where status='published' and deleted_at is null and created_at>=now()-interval '30 days')::int as recent from guestbook_message`,
    required: { published: 21, pending: 1, hidden: 1, replies: 1, owner: 1, pinned: 1, recent: 1 },
  },
]
export const STATIC_DATA_DOMAINS = [
  {
    id: 'bookmarks',
    entry: '/tabs',
    source: 'LocalTabRepository',
    storage: 'localStorage',
    scenarios: '分组、编辑、导入导出；随浏览器隔离',
  },
]

async function inspectOwnership(em: EntityManager, dataset: string, hasLedger: boolean) {
  const report = {
    dataset,
    total: 0,
    original: 0,
    edited: [] as string[],
    deleted: [] as string[],
    state: 'not-seeded',
  }
  if (!hasLedger) return report
  const ownership = await em.execute<{ key: string; kind: FixtureKind; resource_id: string; snapshot_hash: string }[]>(
    'select key,kind,resource_id,snapshot_hash from development_fixture where dataset=? order by key',
    [dataset],
  )
  report.total = ownership.length
  for (const item of ownership) {
    const table = FIXTURE_TABLES[item.kind]
    if (!table) throw new Error('样本归属含未知资源类型，请先核对账本')
    const [row] = await em.execute<Record<string, unknown>[]>(`select * from "${table}" where id=?`, [item.resource_id])
    if (!row || row.deleted_at) report.deleted.push(item.key)
    else if (fixtureHash(row) !== item.snapshot_hash) report.edited.push(item.key)
    else report.original++
  }
  report.state = report.deleted.length
    ? 'deleted-fixtures'
    : report.edited.length
      ? 'edited-fixtures'
      : report.total
        ? 'original'
        : 'not-seeded'
  return report
}

async function inspectContentFiles(em: EntityManager, domain: 'gallery' | 'projects' | 'links') {
  const storage = new LocalMediaStorage(new ConfigService(process.env))
  const assets = await em.execute<{ id: string; storage_key: string; deleted_at: Date | null }[]>(
    domain === 'gallery'
      ? 'select distinct m.id,m.storage_key,m.deleted_at from media_asset m join gallery_photo g on g.media_id=m.id where g.deleted_at is null'
      : domain === 'projects'
        ? 'select distinct m.id,m.storage_key,m.deleted_at from media_asset m join project p on p.cover_media_id=m.id where p.deleted_at is null'
        : 'select distinct m.id,m.storage_key,m.deleted_at from media_asset m join friend_link l on l.logo_media_id=m.id where l.deleted_at is null',
  )
  const unavailable: string[] = []
  for (const asset of assets) {
    if (asset.deleted_at || !(await storage.readIfExists(asset.storage_key))) unavailable.push(asset.id)
  }
  return { checked: assets.length, available: assets.length - unavailable.length, unavailable }
}
export async function inspectDataCatalog(em: EntityManager, domain?: string, search?: string) {
  if (domain && !DATA_DOMAINS.some((item) => item.id === domain)) throw new Error('不支持的数据域')
  const tables = new Set(
    (await em.execute<{ tablename: string }[]>("select tablename from pg_tables where schemaname='public'")).map(
      (row) => row.tablename,
    ),
  )
  const results = []
  for (const item of DATA_DOMAINS.filter((item) => !domain || item.id === domain)) {
    if (!tables.has(item.table)) {
      results.push({
        domain: item.id,
        entry: item.entry,
        admin: item.admin,
        state: 'missing-schema',
        counts: null,
        missing: ['业务数据表尚未建立或迁移未执行'],
        filter: null,
      })
      continue
    }
    const [counts] = await em.execute<Counts[]>(item.query)
    const missing = Object.entries(item.required)
      .filter(([name, minimum]) => (counts?.[name] ?? 0) < minimum)
      .map(([name, minimum]) => `${name} 至少${minimum}项，当前${counts?.[name] ?? 0}项`)
    const ownership = item.dataset
      ? await inspectOwnership(em, item.dataset, tables.has('development_fixture'))
      : undefined
    const media = ['gallery', 'projects', 'links'].includes(item.id)
      ? await inspectContentFiles(em, item.id as 'gallery' | 'projects' | 'links')
      : undefined
    if (item.id === 'projects' && counts?.covered !== counts?.references)
      missing.push(
        `项目封面与媒体引用不一致：${counts?.covered ?? 0}件有封面，${counts?.references ?? 0}件有有效引用；请核对关联并从完整备份恢复`,
      )
    if (item.id === 'links' && counts?.managed !== counts?.references)
      missing.push(
        `友链标志与引用不一致：${counts?.managed ?? 0}件关联媒体，${counts?.references ?? 0}件有有效引用；请核对关联并从完整备份恢复`,
      )
    if (media?.unavailable.length)
      missing.push(`媒体文件不可用：${media.unavailable.length}项；从完整备份恢复文件，不重新补种覆盖作品`)
    let filter: { matched: number; state: string } | null = null
    if (search !== undefined && item.searchColumn) {
      const value = `%${search.slice(0, 200).replace(/[\\%_]/g, (char) => '\\' + char)}%`
      const [match] = await em.execute<{ count: number }[]>(
        `select count(*)::int as count from "${item.table}" where "${item.searchColumn}" ilike ?`,
        [value],
      )
      filter = {
        matched: match!.count,
        state: match!.count ? 'matched' : (counts?.total ?? 0) ? 'normal-empty-filter' : 'empty-dataset',
      }
    }
    results.push({
      domain: item.id,
      entry: item.entry,
      admin: item.admin,
      ...(item.source ? { source: item.source, scenarios: item.scenarios } : {}),
      ...(ownership ? { ownership } : {}),
      ...(media ? { media } : {}),
      state: missing.length
        ? ownership?.deleted.length || ownership?.edited.length
          ? 'changed-fixtures'
          : 'missing-data'
        : 'ready',
      ...(item.dataset
        ? {
            repair: ownership?.deleted.length
              ? '样本已被删除；保留归属且不会复活。需要恢复时使用已核对的完整备份，或通过后台新增内容。'
              : ownership?.edited.length
                ? '已编辑样本保持原样；从后台核对缺少场景并补充内容，不清空或覆盖已有作品。'
                : missing.length
                  ? `corepack pnpm db:dev seed-data --dataset ${item.dataset}；先预览并核对目标，媒体缺失从备份恢复。`
                  : null,
          }
        : {}),
      counts,
      missing,
      filter,
    })
  }
  return {
    version: 1,
    checkedAt: new Date().toISOString(),
    ready: results.every((item) => item.state === 'ready'),
    domains: results,
    preservedSources: STATIC_DATA_DOMAINS,
  }
}
