/** @file post-list-performance.ts @description 隔离长文列表投影前后采样；不清构建目录，不访问日常内容，原始结果仅写入本机 artifacts。 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { EntityManager } from '@mikro-orm/postgresql'
import { PostService } from '../src/modules/post/post.service'
import type { PostItemDto, PostListResult } from '../src/modules/post/post.service'
import { QueryPostDto } from '../src/modules/post/dto/query-post.dto'
import { Post } from '../src/entities/post.entity'
import { PostTag } from '../src/entities/post-tag.entity'
import { PostFolder } from '../src/entities/post-folder.entity'
import { parsePostMarkdown } from '../src/modules/post/post-markdown'
import { createBrowserTestApp } from './test-app.mjs'

type Variant = 'current' | 'legacy-full'
interface QueryCapture {
  sql: string
  params: unknown[]
  driverMs: number
  rowCount: number
  returnedJsonBytes?: number
  columns: string[]
}
interface Sample {
  variant: Variant
  serviceMs: number
  ormMs: number
  dtoMapMs: number
  responseJsonMs: number
  responseBytes: number
  responseHash: string
  total: number
  ids: number[]
  queries: QueryCapture[]
}
async function main() {
  const root = resolve(__dirname, '../../../..')
  const baseline = process.argv.includes('--baseline')
  assert(baseline || process.argv.includes('--compare'), '使用 --baseline 或 --compare')
  const output = resolve(
    root,
    '.artifacts/sustainable-blog/post-list-performance',
    (baseline ? 'baseline-' : 'compare-') + new Date().toISOString().replace(/[:.]/g, '-'),
  )
  assert(output.startsWith(resolve(root, '.artifacts') + '\\') || output.startsWith(resolve(root, '.artifacts') + '/'))
  await mkdir(output, { recursive: true })
  const servicePath = join(root, 'src/backend/server-main/src/modules/post/post.service.ts')
  const serviceSource = await readFile(servicePath, 'utf8')
  const fixture = await createBrowserTestApp('http://localhost')
  const report: Record<string, unknown> = {
    completed: false,
    createdAt: new Date().toISOString(),
    node: process.version,
    git: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceSha256: createHash('sha256').update(serviceSource).digest('hex'),
    mode: baseline ? 'baseline' : 'compare',
    conditions: {
      runtime: 'src TypeScript PostService via tsx; existing compiled isolated fixture only supplies schema/ORM/auth',
      cache: 'fresh ORM fork per request; shared database/OS buffers; 3 warmups per variant; no cold-cache claim',
      timing: '20 paired samples, alternating order; no HTTP/浏览器计时；驱动返回JSON字节单独采样，不计入计时批次',
      control:
        'legacy-full only removes fields from the same findAndCount options; WHERE, ORDER BY, LIMIT, serializer unchanged',
      resources: 'fixture-owned database, media, admin accounts and backup directory; cleaned in finally',
    },
  }
  try {
    const em = fixture.testOrm.em.fork() as EntityManager
    const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
    assert(/^tixxin_browser_\d+_\d+$/.test(database))
    report.database = database
    report.mediaDirectory = basename(process.env.MEDIA_DIRECTORY!)
    report.postgres = (await em.execute<{ version: string }[]>('select version() as version'))[0]!.version
    // 所有内容写入当前隔离库。先使用工厂账号创建一个真实受管封面，不输出账号和令牌。
    const login = await fetch(fixture.origin + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fixture.username, password: fixture.password }),
    })
    assert.equal(login.status, 200)
    const token = (await login.json()).data.accessToken
    const body = new FormData()
    body.append(
      'file',
      new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
      'long-article-cover.png',
    )
    const uploaded = await fetch(fixture.origin + '/api/v1/admin/media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
    assert.equal(uploaded.status, 201)
    const media = (await uploaded.json()).data
    const existing = await em.count(Post, {})
    assert(existing >= 106, '保留测试工厂原有文章，不能用空库制造收益')
    const tag = em.create(PostTag, { label: '工程实践', slug: 'long-form-engineering', color: 'blue', count: 30 })
    const otherTag = em.create(PostTag, { label: '系统设计', slug: 'long-form-design', color: 'sky', count: 30 })
    em.create(PostFolder, { label: '长文写作' })
    const longIds: number[] = []
    const marker = '正文独有中文检索100%_标记'
    for (let index = 0; index < 33; index++) {
      let raw = `# 从约束开始\n\n![封面说明](${media.url})\n\n| 关注点 | 方法 |\n| --- | --- |\n| 运行边界 | 明确输入与输出 |\n\n\`\`\`ts\nconst ready = true\n\`\`\`\n\n`
      let paragraph = 0
      while (Buffer.byteLength(raw) < 102400) {
        const digest = createHash('sha256').update(`${index}:${paragraph}`).digest('hex')
        raw += `## 第 ${paragraph + 1} 节\n\n把复杂问题拆成可验证的步骤，保留上下文、失败恢复与真实使用范围。观察记录 ${digest}，再检查不同边界下的数据行为。\n\n`
        paragraph++
      }
      raw += `\n${marker}\n`
      const post = em.create(Post, {
        title: `长篇架构记录 ${String(index + 1).padStart(2, '0')}`,
        summary: '从真实约束出发整理开发过程与设计取舍。',
        cover: media.url,
        folder: '长文写作',
        category: index % 2 ? 'life' : 'tech',
        readTimeMinutes: 90,
        contentRaw: raw,
        contentSections: parsePostMarkdown(raw),
        status: index === 30 ? 'draft' : index === 31 ? 'archived' : 'published',
        deletedAt: index === 32 ? new Date('2026-09-11T01:00:00Z') : undefined,
        publishedAt: new Date('2026-09-11T00:00:00Z'),
        createdAt: new Date('2026-09-11T00:00:00Z'),
        updatedAt: new Date('2026-09-11T00:00:00Z'),
        pinned: index % 5 === 0,
        likes: 0,
        views: 0,
        commentCount: 0,
      })
      post.tags.add(tag, otherTag)
      await em.flush()
      if (index < 30) longIds.push(post.id)
    }
    report.inventory = await em.execute(`select status,deleted_at is not null as deleted,count(*)::int as posts,
    min(octet_length(coalesce(content_raw,'')))::int as min_raw_bytes,max(octet_length(coalesce(content_raw,'')))::int as max_raw_bytes,
    sum(octet_length(coalesce(content_raw,'')))::bigint as raw_bytes,sum(octet_length(content_sections::text))::bigint as section_json_bytes
    from post group by status,deleted_at is not null order by status,deleted`)
    report.longArticleIds = longIds
    report.longArticlePublicCount = 30
    await em.execute('analyze post')
    await em.execute('analyze post_tag_map')
    await em.execute('analyze post_tag')

    const connection = em.getConnection()
    const originalExecute = connection.execute.bind(connection)
    let captures: QueryCapture[] | null = null,
      captureBytes = false
    connection.execute = (async (...args: unknown[]) => {
      const input = args[0] as string | { toSQL(): { sql: string; bindings?: unknown[] } }
      const statement =
        typeof input === 'string' ? { sql: input, bindings: (args[1] as unknown[]) ?? [] } : input.toSQL()
      const started = performance.now()
      const result = await Reflect.apply(originalExecute, connection, args)
      const driverMs = performance.now() - started
      if (captures && /^select\b/i.test(statement.sql.trim())) {
        const rows = Array.isArray(result) ? result : result ? [result] : []
        captures.push({
          sql: statement.sql,
          params: statement.bindings ?? [],
          driverMs,
          rowCount: rows.length,
          columns: rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]) : [],
          ...(captureBytes ? { returnedJsonBytes: Buffer.byteLength(JSON.stringify(result)) } : {}),
        })
      }
      return result
    }) as typeof connection.execute

    async function sample(
      variant: Variant,
      query: QueryPostDto,
      bytes = false,
    ): Promise<{ sample: Sample; payload: PostListResult }> {
      const manager = fixture.testOrm.em.fork() as EntityManager
      const originalFind = manager.findAndCount.bind(manager)
      let ormMs = 0,
        dtoMapMs = 0
      manager.findAndCount = (async (entity: never, where: never, options: Record<string, unknown>) => {
        const fields = options.fields
        if (variant === 'current') assert.equal(Array.isArray(fields), !baseline, '当前服务投影与采样阶段不符')
        const settings = { ...options }
        if (variant === 'legacy-full') delete settings.fields
        const started = performance.now()
        const result = await originalFind(entity, where, settings)
        ormMs += performance.now() - started
        return result
      }) as typeof manager.findAndCount
      const service = new PostService(manager)
      const serializer = service as unknown as { toPostItem(post: Post): PostItemDto }
      const originalSerialize = serializer.toPostItem.bind(service)
      serializer.toPostItem = (post) => {
        const started = performance.now()
        const result = originalSerialize(post)
        dtoMapMs += performance.now() - started
        return result
      }
      captures = []
      captureBytes = bytes
      const started = performance.now()
      const payload = await service.findMany(query)
      const serviceMs = performance.now() - started
      const jsonStarted = performance.now()
      const json = JSON.stringify(payload)
      const responseJsonMs = performance.now() - jsonStarted
      const queries = captures
      captures = null
      captureBytes = false
      return {
        payload,
        sample: {
          variant,
          serviceMs,
          ormMs,
          dtoMapMs,
          responseJsonMs,
          responseBytes: Buffer.byteLength(json),
          responseHash: createHash('sha256').update(json).digest('hex'),
          total: payload.total,
          ids: payload.items.map((item) => item.id),
          queries,
        },
      }
    }
    const cases = {
      list: Object.assign(new QueryPostDto(), { pageSize: 12 }),
      bodySearch: Object.assign(new QueryPostDto(), { search: marker, pageSize: 12 }),
      pageTwo: Object.assign(new QueryPostDto(), { page: 2, pageSize: 12 }),
    }
    const variants: Variant[] = baseline ? ['current'] : ['legacy-full', 'current']
    const metadata: Record<string, unknown> = {},
      samples: Record<string, Sample[]> = {}
    for (const [name, query] of Object.entries(cases)) {
      samples[name] = []
      const captured = []
      for (const variant of variants) {
        const result = await sample(variant, query, true)
        assert(
          result.payload.items.every((item) => longIds.includes(item.id)),
          '受测页面必须包含代表性长文',
        )
        assert.equal(result.payload.total, name === 'bodySearch' ? 30 : existing + 30)
        const plans = []
        for (const statement of result.sample.queries)
          plans.push({
            sql: statement.sql,
            params: statement.params,
            explain: await originalExecute(
              'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + statement.sql,
              statement.params,
            ),
          })
        captured.push({ variant, payload: result.payload, capture: result.sample, plans })
      }
      if (!baseline) assert.deepEqual(captured[0]!.payload, captured[1]!.payload, `${name} 完整业务payload不变`)
      if (!baseline) {
        const beforeBytes = captured[0]!.capture.queries.reduce((sum, value) => sum + value.returnedJsonBytes!, 0)
        const afterBytes = captured[1]!.capture.queries.reduce((sum, value) => sum + value.returnedJsonBytes!, 0)
        assert(afterBytes < beforeBytes / 10, '长文列表应显著减少取回体积；不设易波动的计时阈值')
        const columns = captured[1]!.capture.queries.flatMap((value) => value.columns)
        assert(!columns.includes('content_raw') && !columns.includes('content_sections'))
      }
      metadata[name] = captured
      for (let warm = 0; warm < 3; warm++) for (const variant of variants) await sample(variant, query)
      for (let index = 0; index < 20; index++) {
        const ordered = index % 2 ? [...variants].reverse() : variants
        for (const variant of ordered) samples[name]!.push((await sample(variant, query)).sample)
      }
    }
    // 额外保留类别、标签、置顶、排序和全文检索组合，不把只测首屏当作业务验证。
    const checks = []
    for (const input of [
      { tag: 'long-form-engineering', category: 'tech', page: 2, pageSize: 7 },
      { search: '100%_', pinned: false, sort: 'likes', order: 'asc', pageSize: 8 },
      { folder: '长文写作', pinnedFirst: false, sort: 'date', page: 3, pageSize: 10 },
    ]) {
      const query = Object.assign(new QueryPostDto(), input)
      const current = await sample('current', query)
      if (!baseline) assert.deepEqual(current.payload, (await sample('legacy-full', query)).payload)
      checks.push({
        input,
        total: current.payload.total,
        ids: current.payload.items.map((item) => item.id),
        responseHash: current.sample.responseHash,
      })
    }
    const paginationIds: number[] = []
    for (let page = 1; page <= 3; page++) {
      const query = Object.assign(new QueryPostDto(), { folder: '长文写作', pageSize: 12, page })
      const current = await sample('current', query)
      if (!baseline) assert.deepEqual(current.payload, (await sample('legacy-full', query)).payload)
      paginationIds.push(...current.payload.items.map((item) => item.id))
    }
    assert.equal(new Set(paginationIds).size, 30)
    assert.deepEqual(
      paginationIds.slice().sort((a, b) => a - b),
      longIds.slice().sort((a, b) => a - b),
    )
    report.stablePaginationIds = paginationIds
    // 采样完成后再验证真实状态变化，避免改变任何受测查询的数据规模。
    const scope = Object.assign(new QueryPostDto(), { search: marker, pageSize: 12 })
    const stateCounts = []
    for (const state of ['draft', 'published']) {
      await em.execute('update post set status=? where id=?', [state, longIds[0]!])
      const current = await sample('current', scope)
      if (!baseline) assert.deepEqual(current.payload, (await sample('legacy-full', scope)).payload)
      assert.equal(current.payload.total, state === 'draft' ? 29 : 30)
      stateCounts.push({ state, total: current.payload.total })
    }
    report.stateCounts = stateCounts
    const summary = (values: number[]) => {
      const sorted = values.slice().sort((a, b) => a - b)
      return {
        count: sorted.length,
        median: (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2,
        min: sorted[0],
        max: sorted.at(-1),
      }
    }
    report.summaries = Object.fromEntries(
      Object.entries(samples).map(([name, values]) => [
        name,
        Object.fromEntries(
          variants.map((variant) => {
            const set = values.filter((value) => value.variant === variant)
            return [
              variant,
              {
                serviceMs: summary(set.map((item) => item.serviceMs)),
                ormMs: summary(set.map((item) => item.ormMs)),
                dtoMapMs: summary(set.map((item) => item.dtoMapMs)),
                responseJsonMs: summary(set.map((item) => item.responseJsonMs)),
                responseBytes: set[0]!.responseBytes,
                responseHashes: [...new Set(set.map((item) => item.responseHash))],
              },
            ]
          }),
        ),
      ]),
    )
    report.captures = metadata
    report.samples = samples
    report.correctness = checks
    report.completed = true
    connection.execute = originalExecute
  } finally {
    await fixture.close()
    report.cleaned = true
    await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  process.stdout.write(JSON.stringify({ output, summaries: report.summaries, cleaned: report.cleaned }, null, 2) + '\n')
}
void main().catch((error) => {
  process.stderr.write(String(error.stack ?? error) + '\n')
  process.exitCode = 1
})
