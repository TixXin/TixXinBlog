/** @file moment-values.spec.ts @description 朋友圈输入边界与稳定提交指纹回归 */
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SaveMomentDto, QueryMomentsDto } from './moment.dto'
import { BadRequestException } from '@nestjs/common'
import { assertSecureEmbeds, momentUrl, momentValues, momentWhere, submissionHash } from './moment-values'

describe('朋友圈输入与提交边界', () => {
  it.each(['content', 'images', 'topics', 'status', 'isPinned', 'revision', 'requestId'])(
    '%s 不接受 null 绕过字段校验',
    (field) => {
      expect(validateSync(plainToInstance(SaveMomentDto, { [field]: null }))).not.toHaveLength(0)
    },
  )
  it('可空引用字段支持显式清除，正文与话题规范化保持一致', () => {
    const body = plainToInstance(SaveMomentDto, {
      content: ' 正文 ',
      topics: [' #生活 ', '生活'],
      linkedArticleId: null,
      linkedLink: null,
    })
    expect(validateSync(body)).toHaveLength(0)
    expect(momentValues(body)).toEqual({ content: '正文', topics: ['生活'], linkedArticleId: null, linkedLink: null })
  })
  it.each(['javascript:alert(1)', 'file:///tmp/a.png', 'https://user:password@example.com/a', '//example.com/a'])(
    '拒绝危险或不完整链接 %s',
    (url) => {
      expect(() => momentUrl(url, true)).toThrow()
    },
  )
  it.each(['http://example.com/image.webp', 'https://example.com/image.webp'])(
    '正文链接、图片和头像允许完整 HTTP(S) 地址 %s',
    (url) => {
      expect(momentUrl(url)).toBe(url)
      expect(momentUrl(url, true)).toBe(url)
      expect(momentUrl(url, true, true)).toBe(url)
    },
  )
  it.each([
    'ftp://example.com/a.png',
    'data:image/png;base64,AAAA',
    'mailto:reader@example.com',
    '/outside.png',
    'example.com/a',
    'https://user@example.com/a',
  ])('链接和头像的业务校验拒绝不受支持的协议、凭据或相对地址 %s', (url) => {
    expect(() => momentUrl(url)).toThrow()
    expect(() => momentUrl(url, true, true)).toThrow()
  })
  it('头像默认值和本站媒体只在对应用途下开放', () => {
    const media = '/api/v1/media/12345678-1234-4123-8123-123456789abc.webp'
    for (const avatar of ['', '/avatar.svg', '/avatar-photo.webp']) {
      expect(momentUrl(avatar, true, true)).toBe(avatar)
      expect(() => momentUrl(avatar, true)).toThrow()
    }
    expect(momentUrl(media, true)).toBe(media)
    expect(() => momentUrl(media)).toThrow()
    expect(() => momentUrl('/api/v1/media/not-a-uuid.webp', true)).toThrow()
  })
  it.each(['images', 'url', 'image', 'favicon'] as const)('朋友圈 %s 字段逐一经过业务协议校验', (field) => {
    const unsafe = 'javascript:alert(1)'
    const input =
      field === 'images'
        ? { images: [unsafe] }
        : { linkedLink: { title: '相关阅读', url: 'https://example.com/', [field]: unsafe } }
    expect(() => momentValues(input)).toThrow()
  })
  it('媒体路径统一大小写，提交指纹不受对象字段顺序影响', () => {
    const url = '/api/v1/media/12345678-1234-4123-A123-123456789ABC.webp'
    expect(momentUrl(url, true)).toBe(url.toLowerCase())
    expect(submissionHash({ content: '正文', linkedLink: { title: '标题', url: 'https://example.com/' } })).toBe(
      submissionHash({ linkedLink: { url: 'https://example.com/', title: '标题' }, content: '正文' }),
    )
  })
  it('日期拒绝不存在的公历日，页面大小有上限', () => {
    expect(validateSync(plainToInstance(QueryMomentsDto, { date: '2026-02-30', pageSize: 151 }))).toHaveLength(2)
    expect(validateSync(plainToInstance(QueryMomentsDto, { date: '2026-02-28', pageSize: 150 }))).toHaveLength(0)
    expect(
      validateSync(plainToInstance(QueryMomentsDto, { after: '1.3b8ada68-c31e-458a-9bde-12cf04e2473e' })),
    ).toHaveLength(0)
    for (const after of ['2.3b8ada68-c31e-458a-9bde-12cf04e2473e', '1.not-a-uuid', '1;drop'])
      expect(validateSync(plainToInstance(QueryMomentsDto, { after }))).toHaveLength(1)
  })
})

describe('足迹按地点精确筛选', () => {
  it('地点参数去首尾空白后精确匹配，空值与超长拒绝', () => {
    expect(momentWhere(plainToInstance(QueryMomentsDto, { location: ' 杭州 ' }))).toMatchObject({ location: '杭州' })
    expect(validateSync(plainToInstance(QueryMomentsDto, { location: '' }))).toHaveLength(1)
    expect(validateSync(plainToInstance(QueryMomentsDto, { location: 'x'.repeat(161) }))).toHaveLength(1)
  })
})

describe('后台保存的内嵌图片只收 HTTPS', () => {
  const media = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
  it('新动态的 HTTP 配图、链接卡片图片或图标被拒绝，HTTPS 与本站媒体通过', () => {
    expect(() => assertSecureEmbeds({ images: ['http://example.com/a.webp'] }, null)).toThrow(BadRequestException)
    expect(() =>
      assertSecureEmbeds(
        { linkedLink: { url: 'http://example.com', title: 'x', image: 'http://example.com/i.png' } },
        null,
      ),
    ).toThrow(BadRequestException)
    expect(() =>
      assertSecureEmbeds(
        { linkedLink: { url: 'http://example.com', title: 'x', favicon: 'http://example.com/f.ico' } },
        null,
      ),
    ).toThrow(BadRequestException)
    // 链接目标本身可以是 HTTP，只限制页面里要加载的图片
    expect(() =>
      assertSecureEmbeds(
        { images: ['https://example.com/a.webp', media], linkedLink: { url: 'http://example.com', title: 'x' } },
        null,
      ),
    ).not.toThrow()
  })
  it('编辑时原记录已有的 HTTP 地址照常保留，新加的仍被拒绝', () => {
    const existing = {
      images: ['http://old.example.com/a.webp'],
      linkedLink: { image: 'http://old.example.com/i.png' },
    }
    expect(() =>
      assertSecureEmbeds({ images: ['http://old.example.com/a.webp', 'http://old.example.com/i.png'] }, existing),
    ).not.toThrow()
    expect(() =>
      assertSecureEmbeds({ images: ['http://old.example.com/a.webp', 'http://new.example.com/b.webp'] }, existing),
    ).toThrow(BadRequestException)
  })
})
