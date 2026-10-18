/** @file prompts-public-response.spec.ts @description 图片提示词公开列表、详情及模型标签统计的字段白名单回归 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ImagePrompt } from '../../entities/image-prompt.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { PromptQuery } from './prompts.dto'
import { PromptsService } from './prompts.service'

const publishedAt = new Date('2026-10-01T08:00:00.000Z')
const mediaId = '11111111-1111-4111-8111-111111111111'
const publicPrompt = {
  id: 1,
  title: '傍晚的海岸',
  description: '柔和光线与自然纹理',
  prompt: '海面映着夕阳，细腻的胶片质感',
  negativePrompt: '文字，水印',
  model: 'Flux',
  tags: ['摄影', '风景'],
  imageUrl: `/api/v1/media/${mediaId}.webp`,
  imageAlt: '橙色夕阳下的海岸',
  width: 1600,
  height: 1000,
  sourceUrl: 'https://example.com/coast',
  publishedAt: publishedAt.toISOString(),
}

function fixture() {
  const media = Object.assign(new MediaAsset(), {
    id: mediaId,
    width: 1600,
    height: 1000,
    mimeType: 'image/webp',
    originalName: 'private-prompt-image.jpg',
    storageKey: 'private/storage/key',
    sha256: 'private-media-sha256',
    byteSize: 98765,
    createdAt: publishedAt,
  })
  const prompt: ImagePrompt = Object.assign(new ImagePrompt(), {
    id: 1,
    title: '傍晚的海岸',
    description: '柔和光线与自然纹理',
    prompt: '海面映着夕阳，细腻的胶片质感',
    negativePrompt: '文字，水印',
    model: 'Flux',
    tags: ['摄影', '风景'],
    media,
    externalImageUrl: null,
    imageAlt: '橙色夕阳下的海岸',
    sourceUrl: 'https://example.com/coast',
    status: 'published',
    publishedAt,
    revision: 17,
    requestId: 'private-request-id',
    requestHash: 'private-request-hash',
    visitorHash: 'private-visitor-hash',
    ip: '192.0.2.17',
    email: 'private@example.invalid',
    createdAt: publishedAt,
    updatedAt: publishedAt,
  })
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[prompt], 1]),
    findOne: jest.fn().mockResolvedValue(prompt),
    execute: jest.fn(),
  }
  return { prompt, em, service: new PromptsService(em as unknown as EntityManager) }
}

describe('图片提示词公开 GET 字段白名单', () => {
  it('列表保留完整公开生成配方，排除发布状态、版本和提交身份', async () => {
    const { em, service } = fixture()
    const result = await service.list(Object.assign(new PromptQuery(), { status: 'draft' }))
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({ items: [publicPrompt], total: 1, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      ImagePrompt,
      { status: 'published' },
      expect.objectContaining({ populate: ['media'] }),
    )
  })

  it('详情仅返回配方与公开媒体信息，草稿标题和管理元数据不进入响应', async () => {
    const { em, service } = fixture()
    expect(JSON.parse(JSON.stringify(await service.detail(1)))).toStrictEqual(publicPrompt)
    expect(em.findOne).toHaveBeenCalledWith(ImagePrompt, { id: 1, status: 'published' }, { populate: ['media'] })
  })

  it('外部图片与可选空值仍遵守相同白名单', () => {
    const { prompt, service } = fixture()
    prompt.media = null
    prompt.externalImageUrl = 'https://images.example/coast.png'
    prompt.sourceUrl = ''
    prompt.negativePrompt = ''
    prompt.model = ''
    prompt.tags = []
    prompt.publishedAt = null
    expect(JSON.parse(JSON.stringify(service.serialize(prompt)))).toStrictEqual({
      ...publicPrompt,
      negativePrompt: '',
      model: '',
      tags: [],
      imageUrl: 'https://images.example/coast.png',
      width: null,
      height: null,
      sourceUrl: '',
      publishedAt: null,
    })
  })

  it('不可公开详情只执行受 published 限制的读取并返回不存在', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(2)).rejects.toThrow('提示词不存在或尚未公开')
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(ImagePrompt, { id: 2, status: 'published' }, { populate: ['media'] })
  })

  it('统计只投影公开内容的模型、标签及其计数', async () => {
    const { em, service } = fixture()
    em.execute.mockResolvedValue([
      {
        stats: { prompts: 3, models: 1, tags: 2 },
        models: [{ label: 'Flux', count: 3 }],
        tags: [
          { label: '摄影', count: 3 },
          { label: '风景', count: 2 },
        ],
      },
    ])
    expect(JSON.parse(JSON.stringify(await service.metadata()))).toStrictEqual({
      stats: { prompts: 3, models: 1, tags: 2 },
      models: [{ label: 'Flux', count: 3 }],
      tags: [
        { label: '摄影', count: 3 },
        { label: '风景', count: 2 },
      ],
    })
    expect(em.execute).toHaveBeenCalledTimes(1)
    const sql = em.execute.mock.calls[0]?.[0] as string
    expect(sql).toContain("select id,model,tags from image_prompt where status='published'")
    expect(sql).toContain("jsonb_build_object('prompts',")
    expect(sql.match(/jsonb_build_object\('label',label,'count',count\)/g)).toHaveLength(2)
    expect(sql).not.toMatch(/select\s+\*|revision|request_hash|storage_key/i)
  })
})
