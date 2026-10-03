/** @file prompts-values.spec.ts @description 提示词输入边界、局部更新和地址安全回归 */
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminPromptQuery, PromptQuery, SavePromptDto } from './prompts.dto'
import { promptId, promptSourceUrl, promptValues, promptWhere } from './prompts-values'

describe('图片提示词边界', () => {
  it.each([
    'title',
    'description',
    'prompt',
    'negativePrompt',
    'model',
    'tags',
    'imageAlt',
    'sourceUrl',
    'status',
    'requestId',
    'revision',
  ])('%s 不接受 null 绕过校验', (field) =>
    expect(validateSync(plainToInstance(SavePromptDto, { [field]: null }))).not.toHaveLength(0),
  )

  it('保留局部更新省略语义，媒体来源允许显式清空', () => {
    const body = plainToInstance(SavePromptDto, { revision: 0, description: '  补充说明  ', mediaId: null })
    expect(validateSync(body)).toHaveLength(0)
    expect(promptValues(body)).toEqual({ description: '补充说明', mediaId: null })
    expect(promptValues(plainToInstance(SavePromptDto, { revision: 1 }))).toEqual({})
  })

  it('按首个拼写去重标签并保留提示词内部换行', () => {
    const body = plainToInstance(SavePromptDto, {
      tags: [' Editorial ', 'editorial', '夜色'],
      prompt: '  第一行\n  second line  ',
    })
    expect(validateSync(body)).toHaveLength(0)
    expect(promptValues(body)).toEqual({ tags: ['Editorial', '夜色'], prompt: '第一行\n  second line' })
  })

  it.each([
    { title: ' ' },
    { prompt: ' ' },
    { tags: [' '] },
    { tags: [123] },
    { tags: Array(13).fill('标签') },
    { title: '📷'.repeat(81) },
    { tags: ['📷'.repeat(17)] },
    { prompt: '字'.repeat(30001) },
    { externalImageUrl: '' },
    { revision: 0.5 },
    { status: 'withdrawn' },
  ])('拒绝非法字段 %j', (body) => {
    expect(validateSync(plainToInstance(SavePromptDto, body))).not.toHaveLength(0)
  })

  it.each([
    'javascript:alert(1)',
    'file:///tmp/a.png',
    '//example.com/a',
    'https://user:password@example.com/a',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\n.png',
  ])('拒绝危险或不完整图片和来源 %s', (url) => {
    expect(() => promptValues({ externalImageUrl: url })).toThrow()
    expect(() => promptSourceUrl(url)).toThrow()
  })

  it('外部图片保留编码语义，来源链接规范化，受管媒体不允许伪装成外链', () => {
    const external = 'https://example.com/image%2F1.png?a=1&a=2#preview'
    expect(promptValues({ externalImageUrl: external, sourceUrl: ' HTTPS://EXAMPLE.COM:443/Work ' })).toEqual({
      externalImageUrl: external,
      sourceUrl: 'https://example.com/Work',
    })
    expect(promptSourceUrl('')).toBe('')
    expect(() =>
      promptValues({ externalImageUrl: 'https://example.com/api/v1/media/12345678-1234-4123-a123-123456789abc.webp' }),
    ).toThrow()
  })

  it('公开查询不能绕过草稿过滤，百分号与下划线按字面搜索', () => {
    const query = plainToInstance(AdminPromptQuery, { q: '100%_完成', model: 'Flux_1', status: 'draft' })
    const where = promptWhere(query)
    expect(where).toMatchObject({
      status: 'published',
      model: { $ilike: 'Flux\\_1' },
      $or: expect.arrayContaining([{ title: { $ilike: '%100\\%\\_完成%' } }]),
    })
    expect(promptWhere(query, true)).toMatchObject({ status: 'draft' })
    expect(validateSync(plainToInstance(PromptQuery, { pageSize: 49, page: 0 }))).toHaveLength(2)
  })

  it.each([0, -1, 1.5, 2147483648, Number.NaN])('拒绝非法编号 %s', (id) => expect(() => promptId(id)).toThrow())
})
