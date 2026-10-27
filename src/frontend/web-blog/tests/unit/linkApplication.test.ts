/** @file linkApplication.test.ts @description 友链申请的提交前校验、审核筛选解析与错误文案分流 */
import { describe, expect, it } from 'vitest'
import {
  emptyLinkApplication,
  linkApplicationFilter,
  linkApplicationLimits,
  linkApplicationPage,
  linkApplicationValid,
  trimLinkApplication,
} from '../../app/features/link/application'
import { failureStatus, failureText, linkRequestFailure } from '../../app/features/link/requestFailure'

const valid = { ...emptyLinkApplication(), name: '松下问童子', url: 'https://pine.example.org/blog' }
const t = (key: string) => `译:${key}`

describe('友链申请字段校验', () => {
  it('名称与 HTTP(S) 地址必填，其余字段可空', () => {
    expect(linkApplicationValid(valid)).toBe(true)
    expect(linkApplicationValid({ ...valid, name: '   ' })).toBe(false)
    expect(linkApplicationValid({ ...valid, url: 'pine.example.org' })).toBe(false)
    expect(linkApplicationValid({ ...valid, url: 'ftp://pine.example.org' })).toBe(false)
    expect(linkApplicationValid({ ...valid, url: 'https:// pine.example.org' })).toBe(false)
    expect(linkApplicationValid({ ...valid, url: ' http://pine.example.org ' })).toBe(true)
  })

  it('各字段按服务端上限拒绝超长输入', () => {
    for (const field of ['name', 'description', 'contact', 'message'] as const) {
      const limit = linkApplicationLimits[field]
      expect(linkApplicationValid({ ...valid, [field]: '字'.repeat(limit) })).toBe(true)
      expect(linkApplicationValid({ ...valid, [field]: '字'.repeat(limit + 1) })).toBe(false)
    }
  })

  it('提交前去除首尾空白，不改写地址大小写与路径', () => {
    expect(
      trimLinkApplication({ ...valid, url: ' https://Pine.example.org/Blog/ ', contact: '  ', message: ' 你好 ' }),
    ).toEqual({ ...valid, url: 'https://Pine.example.org/Blog/', contact: '', message: '你好' })
  })
})

describe('审核筛选解析', () => {
  it('未知状态回到待审，页码限制在合法范围', () => {
    expect(linkApplicationFilter('handled')).toBe('handled')
    expect(linkApplicationFilter('approved')).toBe('pending')
    expect(linkApplicationFilter(undefined)).toBe('pending')
    expect(linkApplicationPage('3')).toBe(3)
    expect(linkApplicationPage('0')).toBe(1)
    expect(linkApplicationPage('1.5')).toBe(1)
    expect(linkApplicationPage('10001')).toBe(1)
  })
})

describe('申请请求错误文案', () => {
  it('4xx 优先使用后端 message，5xx 与网络故障使用通用文案', () => {
    const conflict = Object.assign(new Error('409'), {
      statusCode: 409,
      data: { code: 40, message: '该地址已有一条待审核的申请', data: null },
    })
    expect(linkRequestFailure(conflict, t)).toMatchObject({ message: '该地址已有一条待审核的申请', statusCode: 409 })
    expect(linkRequestFailure(Object.assign(new Error('500'), { statusCode: 500 }), t).message).toBe(
      '译:interaction.links.serviceUnavailable',
    )
    expect(linkRequestFailure(new TypeError('fetch failed'), t).message).toBe('译:interaction.links.serviceUnavailable')
  })

  it('状态码与兜底文案只从错误对象读取', () => {
    expect(failureStatus({ statusCode: 409 })).toBe(409)
    expect(failureStatus(null)).toBeUndefined()
    expect(failureText(new Error('已生成文案'), '兜底')).toBe('已生成文案')
    expect(failureText('unknown', '兜底')).toBe('兜底')
  })
})
