/** @file editorial-package.ts @description 四候选v9子包，只保留阅读关系闭包和必要目录，不复制来源配置、互动或开发样本。 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { IsolationLevel } from '@mikro-orm/core'
import { ConfigService } from '@nestjs/config'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { LocalMediaStorage } from '../modules/media/media-storage'
import { managedMediaIds } from '../modules/media/media-references'
import { ContentExportService } from '../modules/backup/content-export.service'
import { parseContentPackage, packageHash } from '../modules/backup/content-package'
import type { ContentPackage } from '../modules/backup/content-package'
import { inspectEditorialContent } from './editorial-review'
import { editorialPostSnapshot, editorialProjectInput, editorialRelations } from './editorial-model'
import { editorialArticles, EDITORIAL_CONTENT_VERSION } from './editorial-content'
import { editorialTarget } from './editorial-maintenance'

export async function buildEditorialPackage(
  source: ContentPackage,
  review: Awaited<ReturnType<typeof inspectEditorialContent>>,
) {
  if (!review.ready) throw new Error('候选尚未全部通过精确审阅；保留已编辑或删除内容，不生成混合首发包')
  const posts = editorialArticles.map((article) => {
    const row = source.posts.find((item) => item.sourceId === review.ids[article.key])
    if (!row || row.deleted) throw new Error('首发文章缺失或已删除')
    const { contentSections: _contentSections, ...expected } = editorialPostSnapshot(
      article.key,
      editorialRelations(review.ids, article.key),
    )
    void _contentSections
    if (packageHash({ ...row.values, tags: [...row.values.tags].sort() }) !== packageHash(expected))
      throw new Error('首发文章内容在导出前发生变化')
    return {
      ...structuredClone(row),
      comments: [],
      deleted: false,
      values: { ...structuredClone(row.values), status: 'draft' as const },
    }
  })
  const project = source.projects.find((item) => item.sourceId === review.ids.tixxinblog)
  if (
    !project ||
    project.deleted ||
    packageHash(project.values) !== packageHash(editorialProjectInput(editorialRelations(review.ids, 'tixxinblog')))
  )
    throw new Error('首发项目缺失、删除或在导出前发生变化')
  const neededTags = [...new Set(posts.flatMap((post) => post.values.tags))].sort()
  const tags = neededTags.map((label) => {
    const tag = source.tags.find((item) => item.label === label)
    if (!tag) throw new Error('首发标签元数据缺失')
    return { ...tag }
  })
  const values = [...posts.map((post) => post.values), project.values]
  if (managedMediaIds(values).length || posts.some((post) => !!post.values.cover) || project.values.coverMediaId)
    throw new Error('本批候选定义为零媒体依赖；发现非预期图片必须先人工复核')
  const subset: ContentPackage = {
    format: 'tixxin-content',
    version: 9,
    omittedRelations: 0,
    exportedAt: source.exportedAt,
    mediaIncluded: false,
    posts,
    projects: [
      { ...structuredClone(project), deleted: false, values: { ...structuredClone(project.values), status: 'draft' } },
    ],
    flashes: [],
    moments: [],
    guestbook: [],
    gallery: [],
    links: [],
    media: [],
    gallerySettings: { gear: [] },
    linkSettings: { rules: [] },
    folders: [...new Set(posts.map((post) => post.values.folder))],
    tags,
    // v9固定结构要求这些键；它们是中性格式占位，导入必须关闭includeSettings，不代表来源/正式配置。
    site: {
      name: 'TixXin Blog',
      description: '',
      ownerName: 'tixxin',
      ownerTitle: '',
      avatar: '',
      avatarAlt: '',
      seoTitle: '',
      seoDescription: '',
      announcement: '',
      socials: [],
      about: { visible: false, introduction: '', sections: [] },
    },
    requireCommentApproval: false,
  }
  const checked = await parseContentPackage(Buffer.from(JSON.stringify(subset)))
  if (checked.omittedRelations !== 0) throw new Error('候选关联没有形成完整闭包')
  return checked
}
export async function exportEditorialPackage(output?: string) {
  const target = editorialTarget(false)
  const root = resolve(__dirname, '../../../..', '..')
  const artifacts = resolve(root, '.artifacts')
  const path = resolve(
    output ?? resolve(artifacts, 'first-release', `content-${randomUUID()}`, 'editorial-content-v9.json'),
  )
  const rel = relative(artifacts, path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !path.endsWith('.json'))
    throw new Error('首发包只写入仓库.artifacts中的新JSON文件')
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: target.url.toString(),
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    const result = await orm.em.fork().transactional(
      async (em) => {
        const review = await inspectEditorialContent(em)
        const source = await new ContentExportService(
          em,
          new LocalMediaStorage(new ConfigService(process.env)),
        ).snapshot(false, em)
        const content = await buildEditorialPackage(source, review)
        return {
          content,
          report: {
            version: EDITORIAL_CONTENT_VERSION,
            sourceDatabase: target.database,
            sourceIds: review.ids,
            includeSettings: false,
            state: 'draft',
            articles: content.posts.length,
            projects: content.projects.length,
            relations:
              content.posts.reduce((sum, post) => sum + (post.values.relatedContent?.length ?? 0), 0) +
              content.projects[0]!.values.relatedContent.length,
            media: 0,
            folders: content.folders,
            tags: content.tags.map((tag) => tag.label),
            contentHash: packageHash(content),
            note: '只包含四份已核查候选；v9必填站点字段为中性占位，导入不得勾选配置。',
          },
        }
      },
      { isolationLevel: IsolationLevel.REPEATABLE_READ },
    )
    await mkdir(dirname(path), { recursive: true })
    const actualRoot = await realpath(artifacts),
      actualParent = await realpath(dirname(path))
    const parentRel = relative(actualRoot, actualParent)
    if (parentRel.startsWith('..') || isAbsolute(parentRel)) throw new Error('输出父目录超出本机验收产物范围')
    await writeFile(path, JSON.stringify(result.content, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    await writeFile(path.replace(/\.json$/, '.review.json'), JSON.stringify(result.report, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    })
    return { ...result.report, output: path }
  } finally {
    await orm.close(true)
  }
}
