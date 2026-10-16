/** @file project-fixtures.ts @description 项目版本化自然样本；进展独立于公开状态，文档链接不冒充作品仓库或演示站点 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaAsset } from '../entities/media-asset.entity'
import { ProjectService } from '../modules/project/project.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { ensureFixture, fixtureHash, fixtureRow } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const PROJECT_DATASET = 'project-v1'
// 封面与项目内容对应：风景类沿用图库素材，工具类使用真实感样本里的桌面与代码照片；替代文本描述画面。
const assetSources = {
  ridge: ['gallery-assets', '山脊与云层'],
  mist: ['gallery-assets', '山谷里的薄雾'],
  skyline: ['gallery-assets', '城市楼宇'],
  'code-screen': ['showcase-assets', '窗边绿植旁打开的笔记本，屏幕上是代码'],
  workspace: ['showcase-assets', '书桌上的笔记本和几本书'],
  'laptop-code': ['showcase-assets', '白色桌面上的笔记本和一杯咖啡'],
  'city-night': ['showcase-assets', '傍晚的城市街道'],
  bookshelf: ['showcase-assets', '摆满书的书架'],
  terminal: ['showcase-assets', '显示器上的代码，前面放着一副眼镜'],
  'sushi-boat': ['showcase-assets', '寿司船拼盘'],
} as const
const assets = Object.keys(assetSources) as (keyof typeof assetSources)[]
const docs = {
  vue: 'https://vuejs.org/guide/introduction.html',
  typescript: 'https://www.typescriptlang.org/docs/',
  nest: 'https://docs.nestjs.com/',
  web: 'https://developer.mozilla.org/en-US/docs/Web/API',
  postgres: 'https://www.postgresql.org/docs/current/',
  playwright: 'https://playwright.dev/docs/intro',
} as const
const projects = [
  [
    'myblog',
    'active',
    'code-screen',
    ['Nuxt', 'Vue', 'TypeScript', 'NestJS', 'PostgreSQL'],
    'vue',
    '把文章、照片和日常记录放在同一个地方。前台保留多套布局和独立的页面过渡，后台围绕真实内容提供编辑、发布、媒体选择和维护入口。持续整理数据边界、可恢复输入与浏览器验收，让新增能力能够与已有内容共存，也让每一次维护都有可核查的结果。',
  ],
  [
    '山径相册',
    'active',
    'ridge',
    ['Vue', 'TypeScript'],
    'vue',
    '按行程整理照片，一次行程一个相册，支持按拍摄地筛选。目前收了八次行程，最早一次是贡嘎山。',
  ],
  [
    '城市步行地图',
    'dev',
    'skyline',
    ['TypeScript', 'Web API'],
    'web',
    '把散步途中记下的街角连成路线，保留停留地点和沿途笔记。深圳部分已经连起十二条，广州还在补。',
  ],
  [
    '轻量阅读清单',
    'archived',
    null,
    ['Vue', 'TypeScript'],
    'typescript',
    '一份按主题整理的阅读清单，保留读完之后写下的简短感想。停更在去年底，清单本身还留着。',
  ],
  [
    '灵感便签',
    'active',
    'workspace',
    ['Nuxt', 'TypeScript'],
    'typescript',
    '随手记下还没有形成长文的想法，再慢慢整理成有条理的笔记。',
  ],
  ['页面节奏实验', 'dev', null, ['CSS', 'TypeScript'], 'web', '观察页面切换与滚动的节奏，尝试更安静的动态效果。'],
  [
    '组件索引',
    'active',
    'laptop-code',
    ['Vue', 'TypeScript'],
    'vue',
    '为常用组件整理属性、交互和使用情境，减少重复寻找。',
  ],
  [
    'Markdown 工作台',
    'active',
    null,
    ['TypeScript', 'Markdown'],
    'typescript',
    '在书写与预览之间保持简单，让注意力留在文字本身。',
  ],
  [
    '光影手册',
    'dev',
    'city-night',
    ['Nuxt', 'Vue'],
    'vue',
    '记录画面的光线、色彩与构图，逐步整理成便于回看的摄影手册。',
  ],
  ['邮件排版簿', 'archived', null, ['HTML', 'CSS'], 'web', '保存几种清晰易读的邮件排版，照顾窄屏和不同字号。'],
  [
    '家庭书架',
    'active',
    'bookshelf',
    ['Vue', 'PostgreSQL'],
    'postgres',
    '记录家里的书、借出的时间和归还位置，让下一次寻找更轻松。',
  ],
  ['离线待办', 'dev', null, ['TypeScript', 'IndexedDB'], 'web', '即使暂时没有网络，也可以继续安排当天的小事。'],
  [
    '页面体检',
    'active',
    'terminal',
    ['Playwright', 'TypeScript'],
    'playwright',
    '把键盘操作、图片恢复和窄屏布局整理成可重复执行的检查。',
  ],
  ['数据迁移笔记', 'archived', null, ['PostgreSQL', 'NestJS'], 'postgres', '整理迁移前后的核对项，并保留恢复路径。'],
  ['周末菜单', 'active', 'sushi-boat', ['Vue', 'TypeScript'], 'vue', '从常做的几道菜开始，整理用量、步骤和替换食材。'],
  ['轻量计时器', 'archived', null, [], null, ''],
  ['路线规划草稿', 'dev', 'mist', ['TypeScript', 'NestJS'], 'nest', '还在整理路线与停留时间之间的关系。'],
  ['旧版组件集', 'archived', null, ['Vue', 'CSS'], null, '保留旧界面的实现思路，暂时收起公开入口。'],
] as const
const colors = {
  Vue: 'emerald',
  Nuxt: 'emerald',
  TypeScript: 'blue',
  NestJS: 'rose',
  PostgreSQL: 'sky',
  'Web API': 'slate',
  CSS: 'amber',
  Markdown: 'slate',
  HTML: 'amber',
  IndexedDB: 'slate',
  Playwright: 'rose',
} as const
export const PROJECT_FIXTURE_COUNT = projects.length + assets.length

export async function seedProjectFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const media = new Map<string, string>()
  for (const name of assets) {
    const id = await ensureFixture(
      em,
      PROJECT_DATASET,
      name,
      'media',
      async () => {
        // 只复用已核验的素材文件；媒体与归属独立，因此项目可以在尚未补种图库的数据库中运行。
        const [directory, alt] = assetSources[name]
        const buffer = await readFile(resolve(__dirname, '../../src/seeders', directory, `${name}.webp`))
        const id = randomUUID()
        createdMedia.push(id)
        return (
          await new MediaService(em, storage).upload(
            { buffer, originalname: `project-${name}.webp`, mimetype: 'image/webp', size: buffer.length },
            alt,
            id,
          )
        ).id
      },
      progress,
    )
    if (!id) continue
    const asset = await em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset || !(await storage.readIfExists(asset.storageKey))) {
      progress.unavailable.push(`${PROJECT_DATASET}/media/${name}/file`)
      continue
    }
    media.set(name, id)
  }
  const service = new ProjectService(em)
  for (const [index, [title, projectProgress, cover, tags, documentation, description]] of projects.entries()) {
    const id = await ensureFixture(
      em,
      PROJECT_DATASET,
      String(index),
      'project',
      async () => {
        if (cover && !media.has(cover)) return null
        // 唯一源代码地址已经与当前仓库 origin 和公开 GitHub 页面核对；其他链接仅标注文档。
        // 发布页与演示页按该仓库的默认路径给出，覆盖下载与演示两种链接类型；仓库未启用 Pages 时演示地址可能暂不可访问。
        const links: { kind: 'source' | 'docs' | 'demo' | 'download'; href: string }[] =
          index === 0
            ? [
                { kind: 'source', href: 'https://github.com/example/myblog' },
                { kind: 'download', href: 'https://github.com/example/myblog/releases' },
                { kind: 'demo', href: 'https://example.github.io/myblog/' },
              ]
            : []
        if (documentation) links.push({ kind: 'docs', href: docs[documentation] })
        return (
          await service.save(null, {
            requestId: randomUUID(),
            title,
            description,
            coverMediaId: cover ? media.get(cover)! : null,
            tags: tags.map((label) => ({ label, color: colors[label] })),
            links,
            progress: projectProgress,
            status: index === 16 ? 'draft' : index === 17 ? 'withdrawn' : 'published',
            sortOrder: index === 0 ? 100 : index % 3,
          })
        ).id
      },
      progress,
    )
    if (id && cover && media.has(cover)) await syncCover(em, service, id, media.get(cover)!)
  }
}
/** 早期补种的项目用的是轮换风景图；仍未被编辑过的项目改用与内容对应的封面，并重新登记指纹 */
async function syncCover(em: EntityManager, service: ProjectService, id: string, coverMediaId: string) {
  const fixture = await em.findOne(DevelopmentFixture, { kind: 'project', resourceId: id, dataset: PROJECT_DATASET })
  const row = await fixtureRow(em, 'project', id)
  if (!fixture || !row || row.deleted_at || row.cover_media_id === coverMediaId) return
  if (fixtureHash(row) !== fixture.snapshotHash) return
  await service.save(Number(id), { revision: Number(row.revision), coverMediaId })
  const updated = await fixtureRow(em, 'project', id)
  if (updated) fixture.snapshotHash = fixtureHash(updated)
  await em.flush()
}
