/** @file moment-values.spec.ts @description 朋友圈输入边界与稳定提交指纹回归 */
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SaveMomentDto, QueryMomentsDto } from './moment.dto'
import { momentUrl, momentValues, submissionHash } from './moment-values'

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
  it('媒体路径统一大小写，提交指纹不受对象字段顺序影响', () => {
    const url = '/api/v1/media/12345678-1234-4123-A123-123456789ABC.webp'
    expect(momentUrl(url, true)).toBe(url.toLowerCase())
    expect(submissionHash({ content: '正文', linkedLink: { title: '标题', url: 'https://example.com/' } })).toBe(
      submissionHash({ linkedLink: { url: 'https://example.com/', title: '标题' }, content: '正文' }),
    )
  })
  it('日期拒绝不存在的公历日，页面大小有上限', () => {
    expect(validateSync(plainToInstance(QueryMomentsDto, { date: '2026-02-30', pageSize: 100 }))).toHaveLength(2)
    expect(validateSync(plainToInstance(QueryMomentsDto, { date: '2026-02-28', pageSize: 15 }))).toHaveLength(0)
  })
})
