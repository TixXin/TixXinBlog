/** @file prompt-fixtures.ts @description 灵感图鉴幂等样本，复用真实媒体服务，保留既有编辑和删除归属 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaAsset } from '../entities/media-asset.entity'
import { PromptsService } from '../modules/prompts/prompts.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'
import { PROMPT_ORIGINALS, PROMPT_REFERENCES } from './prompt-content'

export const PROMPT_DATASET = 'prompts-v1'
const originalKeys = new Set<string>(PROMPT_ORIGINALS.map((item) => item.key))
const assets = [...originalKeys, ...new Set(PROMPT_REFERENCES.map((item) => item.asset))]
const prompts = [
  ...PROMPT_ORIGINALS.map((item) => ({
    ...item,
    asset: item.key,
    // 原创图记录实际使用的模型；外部参考条目来源页面未标注模型，保持缺省。
    model: { 'dawn-gate': 'Midjourney v6', 'ceramic-light': 'Stable Diffusion XL', 'rain-bookshop': 'Flux.1 dev' }[
      item.key
    ]!,
    sourceUrl: '',
    status: 'published' as const,
  })),
  ...PROMPT_REFERENCES.map((item) => ({ ...item, model: '' })),
]
export const PROMPT_FIXTURE_COUNT = assets.length + prompts.length

export async function seedPromptFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const media = new Map<string, string>()
  for (const name of assets) {
    const id = await ensureFixture(
      em,
      PROMPT_DATASET,
      name,
      'media',
      async () => {
        const folder = originalKeys.has(name) ? 'prompt-assets' : 'gallery-assets'
        const buffer = await readFile(resolve(__dirname, '../../src/seeders', folder, `${name}.webp`))
        const mediaId = randomUUID()
        createdMedia.push(mediaId)
        return (
          await new MediaService(em, storage).upload(
            { buffer, originalname: `${name}.webp`, mimetype: 'image/webp', size: buffer.length },
            prompts.find((item) => item.asset === name)!.imageAlt,
            mediaId,
          )
        ).id
      },
      progress,
    )
    if (!id) continue
    const asset = await em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset || !(await storage.readIfExists(asset.storageKey))) {
      progress.unavailable.push(`${PROMPT_DATASET}/media/${name}/file`)
      continue
    }
    media.set(name, id)
  }
  const service = new PromptsService(em)
  // 原创图最后写入，在按发布日期倒序的首屏可直接比较横、竖与方形构图。
  for (const item of [...prompts].reverse()) {
    await ensureFixture(
      em,
      PROMPT_DATASET,
      item.key,
      'prompt',
      async () => {
        const mediaId = media.get(item.asset)
        if (!mediaId) return null
        return (
          await service.save(null, {
            requestId: randomUUID(),
            mediaId,
            externalImageUrl: null,
            title: item.title,
            description: item.description,
            prompt: item.prompt,
            negativePrompt: 'negativePrompt' in item ? (item.negativePrompt ?? '') : '',
            model: item.model,
            tags: [...item.tags],
            imageAlt: item.imageAlt,
            sourceUrl: item.sourceUrl,
            status: item.status,
          })
        ).id
      },
      progress,
    )
  }
}
