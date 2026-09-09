/** @file development-data-catalog.ts @description 日常开发数据覆盖目录；只读统计真实可见内容，不把页面存在当作业务完成 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { visibleCommentSql } from '../modules/comment/comment-visibility'

type Counts = Record<string, number>
interface Domain {
  id: string
  entry: string
  admin: string
  table: string
  searchColumn?: string
  query: string
  required: Record<string, number>
}
const publicPost = "p.status='published' and p.deleted_at is null"
export const DATA_DOMAINS: Domain[] = [
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
    id: 'projects',
    entry: '/projects',
    source: 'features/project/mock.ts',
    storage: 'demo',
    scenarios: '列表、技术栈、分类',
  },
  {
    id: 'gallery',
    entry: '/gallery',
    source: 'features/gallery/mock.ts',
    storage: 'demo',
    scenarios: '图片、分类、灯箱',
  },
  { id: 'links', entry: '/links', source: 'features/link/mock.ts', storage: 'demo', scenarios: '友链、规则' },
  {
    id: 'bookmarks',
    entry: '/tabs',
    source: 'LocalTabRepository',
    storage: 'localStorage',
    scenarios: '分组、编辑、导入导出；随浏览器隔离',
  },
]
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
      state: missing.length ? 'missing-data' : 'ready',
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
