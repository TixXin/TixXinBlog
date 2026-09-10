/** @file project-fixtures.ts @description 项目版本化自然样本；进展独立于公开状态，文档链接不冒充作品仓库或演示站点 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaAsset } from '../entities/media-asset.entity'
import { ProjectService } from '../modules/project/project.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const PROJECT_DATASET = 'project-v1'
const assets = ['ridge', 'mist', 'skyline'] as const
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
    'TixXinBlog',
    'active',
    'skyline',
    ['Nuxt', 'Vue', 'TypeScript', 'NestJS', 'PostgreSQL'],
    'vue',
    '把文章、照片和日常记录放在同一个地方。前台保留多套布局和独立的页面过渡，后台围绕真实内容提供编辑、发布、媒体选择和维护入口。持续整理数据边界、可恢复输入与浏览器验收，让新增能力能够与已有内容共存，也让每一次维护都有可核查的结果。',
  ],
  ['山径相册', 'active', 'ridge', ['Vue', 'TypeScript'], 'vue', '按行程整理照片，在不同屏幕上保留山色与留白。'],
  [
    '城市步行地图',
    'dev',
    'skyline',
    ['TypeScript', 'Web API'],
    'web',
    '把散步途中记下的街角连成路线，保留停留地点和沿途笔记。',
  ],
  [
    '轻量阅读清单',
    'archived',
    null,
    ['Vue', 'TypeScript'],
    'typescript',
    '一份按主题整理的阅读清单，保留读完之后写下的简短感想。',
  ],
  [
    '灵感便签',
    'active',
    'mist',
    ['Nuxt', 'TypeScript'],
    'typescript',
    '随手记下还没有形成长文的想法，再慢慢整理成有条理的笔记。',
  ],
  ['页面节奏实验', 'dev', null, ['CSS', 'TypeScript'], 'web', '观察页面切换与滚动的节奏，尝试更安静的动态效果。'],
  ['组件索引', 'active', 'skyline', ['Vue', 'TypeScript'], 'vue', '为常用组件整理属性、交互和使用情境，减少重复寻找。'],
  [
    'Markdown 工作台',
    'active',
    null,
    ['TypeScript', 'Markdown'],
    'typescript',
    '在书写与预览之间保持简单，让注意力留在文字本身。',
  ],
  ['光影手册', 'dev', 'ridge', ['Nuxt', 'Vue'], 'vue', '记录画面的光线、色彩与构图，逐步整理成便于回看的摄影手册。'],
  ['邮件排版簿', 'archived', null, ['HTML', 'CSS'], 'web', '保存几种清晰易读的邮件排版，照顾窄屏和不同字号。'],
  [
    '家庭书架',
    'active',
    'mist',
    ['Vue', 'PostgreSQL'],
    'postgres',
    '记录家里的书、借出的时间和归还位置，让下一次寻找更轻松。',
  ],
  ['离线待办', 'dev', null, ['TypeScript', 'IndexedDB'], 'web', '即使暂时没有网络，也可以继续安排当天的小事。'],
  [
    '页面体检',
    'active',
    'skyline',
    ['Playwright', 'TypeScript'],
    'playwright',
    '把键盘操作、图片恢复和窄屏布局整理成可重复执行的检查。',
  ],
  ['数据迁移笔记', 'archived', null, ['PostgreSQL', 'NestJS'], 'postgres', '整理迁移前后的核对项，并保留恢复路径。'],
  ['周末菜单', 'active', 'ridge', ['Vue', 'TypeScript'], 'vue', '从常做的几道菜开始，整理用量、步骤和替换食材。'],
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
        const buffer = await readFile(resolve(__dirname, '../../src/seeders/gallery-assets', `${name}.webp`))
        const id = randomUUID()
        createdMedia.push(id)
        return (
          await new MediaService(em, storage).upload(
            { buffer, originalname: `project-${name}.webp`, mimetype: 'image/webp', size: buffer.length },
            name === 'ridge' ? '山脊与云层' : name === 'mist' ? '山谷里的薄雾' : '城市楼宇',
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
    await ensureFixture(
      em,
      PROJECT_DATASET,
      String(index),
      'project',
      async () => {
        if (cover && !media.has(cover)) return null
        // 唯一源代码地址已经与当前仓库 origin 和公开 GitHub 页面核对；其他链接仅标注文档。
        const links: { kind: 'source' | 'docs'; href: string }[] =
          index === 0 ? [{ kind: 'source', href: 'https://github.com/TixXin/TixXinBlog' }] : []
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
  }
}
