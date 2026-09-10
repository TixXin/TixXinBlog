/** @file link-fixtures.ts @description 友链版本化自然样本；只保存已核对的站点入口，不声称互链，也不自动抓取用户地址 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaAsset } from '../entities/media-asset.entity'
import { FriendLink } from '../entities/friend-link.entity'
import { LinkService } from '../modules/link/link.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const LINK_DATASET = 'link-v1'
const assets = ['vue', 'typescript', 'vite'] as const
export const LINK_EXTERNAL_LOGO = 'https://raw.githubusercontent.com/vuejs/art/master/logo.png'
const links = [
  ['Vue.js', 'https://vuejs.org/', 'vue', '从组件和响应式状态出发，循序渐进地构建网页界面。'],
  [
    'TypeScript',
    'https://www.typescriptlang.org/',
    'typescript',
    '类型系统、语言手册与在线练习，帮助把代码中的约定表达得更清楚。',
  ],
  ['Vite', 'https://vite.dev/', 'vite', '前端开发与构建工具的文档入口。'],
  [
    'MDN Web Docs',
    'https://developer.mozilla.org/',
    null,
    '整理 Web 平台基础知识的文档站点。遇到陌生的 HTML 元素、CSS 属性或浏览器 API 时，可以先从概念、语法和兼容性说明读起，再回到具体页面观察实际行为。学习指南与参考条目各有侧重，适合在系统学习和日常查阅之间切换，也便于沿着相关链接继续追问一个问题。',
  ],
  ['Node.js', 'https://nodejs.org/en', null, 'JavaScript 运行时的发布、学习资料和 API 文档。'],
  ['NestJS', 'https://nestjs.com/', null, '围绕模块、依赖注入和服务组织方式构建后端应用。'],
  ['PostgreSQL', 'https://www.postgresql.org/', null, '关系数据库的官方文档与社区入口。'],
  ['Playwright', 'https://playwright.dev/', null, '通过真实浏览器观察页面行为，整理可重复执行的交互检查。'],
  ['Vue 中文文档', 'https://cn.vuejs.org/', 'external-vue', '用中文阅读 Vue 的核心概念、组件开发与常见实践。'],
  ['TypeScript Handbook', 'https://www.typescriptlang.org/docs/', null, '从基础类型一路读到泛型与类型收窄。'],
  ['Git', 'https://git-scm.com/', null, '版本管理工具、参考手册与学习资料。'],
  ['pnpm', 'https://pnpm.io/', null, '包管理与工作区配置的文档入口。'],
  ['ESLint', 'https://eslint.org/', null, '为 JavaScript 与相关工具链维护一致的代码检查规则。'],
  ['Prettier', 'https://prettier.io/', null, '让格式约定由工具处理，把讨论留给代码本身。'],
  ['Vitest', 'https://vitest.dev/', null, '围绕 Vite 生态组织单元测试、模拟与覆盖率检查。'],
  ['CSS-Tricks', 'https://css-tricks.com/', null, '围绕 CSS、布局与网页制作的文章。'],
  ['webpack', 'https://webpack.js.org/', null, '模块打包与构建配置资料，留待继续整理。'],
  ['Rollup', 'https://rollupjs.org/', null, 'JavaScript 模块打包工具的文档入口。'],
] as const
export const LINK_FIXTURE_COUNT = links.length + assets.length

export async function seedLinkFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const media = new Map<string, string>()
  for (const name of assets) {
    const id = await ensureFixture(
      em,
      LINK_DATASET,
      name,
      'media',
      async () => {
        const buffer = await readFile(resolve(__dirname, '../../src/seeders/link-assets', `${name}.webp`))
        const id = randomUUID()
        createdMedia.push(id)
        return (
          await new MediaService(em, storage).upload(
            { buffer, originalname: `link-${name}.webp`, mimetype: 'image/webp', size: buffer.length },
            name === 'vue'
              ? 'Vue.js 标志（Evan You）'
              : name === 'typescript'
                ? 'TypeScript 标志（Microsoft）'
                : 'Vite 标志',
            id,
          )
        ).id
      },
      progress,
    )
    if (!id) continue
    const asset = await em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset || !(await storage.readIfExists(asset.storageKey))) {
      progress.unavailable.push(`${LINK_DATASET}/media/${name}/file`)
      continue
    }
    media.set(name, id)
  }
  const service = new LinkService(em)
  for (const [index, [name, url, image, description]] of links.entries()) {
    await ensureFixture(
      em,
      LINK_DATASET,
      String(index),
      'link',
      async () => {
        if (image && image !== 'external-vue' && !media.has(image)) return null
        // 用户原有同址内容不接管归属，也不让一个地址冲突阻止其余样本增量写入。
        if (await em.findOne(FriendLink, { url: new URL(url).toString(), deletedAt: null })) {
          progress.unavailable.push(`${LINK_DATASET}/link/${index}/url-already-present`)
          return null
        }
        return (
          await service.save(null, {
            requestId: randomUUID(),
            name,
            description,
            url,
            logoMediaId: image && image !== 'external-vue' ? media.get(image)! : null,
            logoUrl: image === 'external-vue' ? LINK_EXTERNAL_LOGO : null,
            isFeatured: [0, 1, 2, 8, 16].includes(index),
            sortOrder: index === 0 ? 100 : index % 3,
            status: index === 16 ? 'draft' : index === 17 ? 'withdrawn' : 'published',
          })
        ).id
      },
      progress,
    )
  }
}
