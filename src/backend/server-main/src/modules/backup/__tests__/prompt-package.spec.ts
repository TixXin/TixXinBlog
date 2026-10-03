/** @file prompt-package.spec.ts @description 提示词内容包的版本边界、严格字段、图片互斥及草稿去重契约。 */
import 'reflect-metadata'
import { parseContentPackage } from '../content-package'
import { promptContentHash } from '../content-import-plan'

const mediaId = 'bb2a48c1-d233-4c45-9c1e-a21e9a56fd20'
const prompt = () => ({
  sourceId: 1,
  createdAt: '2026-09-30T12:00:00.000Z',
  publishedAt: '2026-10-01T12:00:00.000Z',
  values: {
    title: '窗边的午后',
    description: '让漫射光成为画面的主体。',
    prompt: 'A quiet room with warm diffused window light.\nFine film grain.',
    negativePrompt: 'watermark, oversaturated colors',
    model: 'Flux',
    tags: ['摄影', '光影'],
    mediaId: null as string | null,
    externalImageUrl: 'https://images.example.org/Room.JPG?size=A&size=B#Light' as string | null,
    imageAlt: '午后的窗光落在桌面上',
    sourceUrl: 'https://example.org/process',
    status: 'published' as const,
  },
})
const bundle = () => ({
  format: 'tixxin-content',
  version: 10,
  omittedRelations: 0,
  exportedAt: '2026-10-02T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [],
  moments: [],
  guestbook: [],
  gallery: [],
  projects: [],
  links: [],
  prompts: [prompt()],
  linkSettings: { rules: [] },
  gallerySettings: { gear: [] },
  folders: [],
  tags: [],
  media: [],
  requireCommentApproval: false,
  site: {
    name: '山间札记',
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
})
const parse = (value: unknown) => parseContentPackage(Buffer.from(JSON.stringify(value)))

describe('图片提示词内容包', () => {
  it('完整保留提示词换行及外链编码语义', async () => {
    const input = bundle()
    const parsed = await parse(input)
    expect(parsed.version).toBe(10)
    expect(parsed.prompts).toEqual(input.prompts)
  })

  it('接受真实 v9 并缺省为空，拒绝把提示词夹带到旧版本', async () => {
    const input = { ...bundle(), version: 9 }
    await expect(parse(input)).rejects.toThrow('v1–v9 不支持图片提示词')
    const { prompts, ...legacy } = input
    void prompts
    expect((await parse(legacy)).prompts).toEqual([])
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('v%i 的真实旧字段集仍可读取，提示词缺省为空', async (version) => {
    const legacy: Record<string, unknown> = { ...bundle(), version }
    delete legacy.prompts
    if (version < 9) delete legacy.omittedRelations
    if (version < 8) {
      const { about, ...site } = bundle().site
      void about
      legacy.site = site
    }
    if (version < 6) {
      delete legacy.links
      delete legacy.linkSettings
    }
    if (version < 5) delete legacy.projects
    if (version < 4) {
      delete legacy.gallery
      delete legacy.gallerySettings
    }
    if (version < 3) delete legacy.guestbook
    if (version < 2) delete legacy.moments
    expect((await parse(legacy)).prompts).toEqual([])
    await expect(parse({ ...legacy, prompts: [] })).rejects.toThrow('v1–v9 不支持图片提示词')
  })

  it('拒绝省略 v10 字段、重复编号和请求/版本凭据', async () => {
    const { prompts, ...missing } = bundle()
    await expect(parse(missing)).rejects.toThrow()
    await expect(parse({ ...bundle(), prompts: [...prompts, ...prompts] })).rejects.toThrow('重复图片提示词编号')
    for (const key of ['requestId', 'requestHash', 'revision']) {
      const item = prompt()
      await expect(
        parse({ ...bundle(), prompts: [{ ...item, values: { ...item.values, [key]: 'private' } }] }),
      ).rejects.toThrow()
    }
  })

  it('图片恰好一种来源，禁止用外链绕过受管媒体引用', async () => {
    for (const values of [
      { ...prompt().values, mediaId },
      { ...prompt().values, externalImageUrl: null },
      { ...prompt().values, externalImageUrl: `https://example.org/api/v1/media/${mediaId}.webp` },
      { ...prompt().values, externalImageUrl: 'https://user:secret@example.org/a.webp' },
    ])
      await expect(parse({ ...bundle(), prompts: [{ ...prompt(), values }] })).rejects.toThrow()
    const managed = { ...prompt().values, mediaId, externalImageUrl: null }
    expect((await parse({ ...bundle(), prompts: [{ ...prompt(), values: managed }] })).prompts[0]?.values.mediaId).toBe(
      mediaId,
    )
  })

  it('不接受无意义正文、超长内容或危险来源链接', async () => {
    for (const changed of [
      { prompt: '   ' },
      { title: ' ' },
      { prompt: '字'.repeat(30001) },
      { negativePrompt: '字'.repeat(10001) },
      { sourceUrl: 'javascript:alert(1)' },
      { tags: Array.from({ length: 13 }, (_, index) => String(index)) },
    ])
      await expect(
        parse({ ...bundle(), prompts: [{ ...prompt(), values: { ...prompt().values, ...changed } }] }),
      ).rejects.toThrow()
  })

  it('跳过策略忽略发布状态与标签顺序，但保留正文和图片差异', () => {
    const values = prompt().values
    expect(promptContentHash(values)).toBe(
      promptContentHash({ ...values, status: 'draft', tags: [...values.tags].reverse() }),
    )
    expect(promptContentHash(values)).not.toBe(promptContentHash({ ...values, prompt: values.prompt + ' Changed.' }))
    expect(promptContentHash(values)).not.toBe(promptContentHash({ ...values, mediaId, externalImageUrl: null }))
  })
})
