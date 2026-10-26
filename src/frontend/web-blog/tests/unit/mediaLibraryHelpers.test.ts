/** @file mediaLibraryHelpers.test.ts @description 媒体库纯函数回归：筛选取值、列表与地址查询、上传校验、删除结果与引用标签 */
import { describe, expect, it } from 'vitest'
import {
  failedRemovalResult,
  isAcceptedMediaUpload,
  mediaAddressQuery,
  mediaErrorText,
  mediaLastPage,
  mediaListQuery,
  mediaReferenceLabel,
  readMediaOrientation,
  readMediaPage,
  readMediaUsage,
  referencedRemovalResult,
} from '../../app/features/media/library'
import type { MediaAsset, MediaReferences } from '../../app/features/media/types'

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
const asset = { id: 'a1', name: 'cover.png' } as MediaAsset

describe('筛选取值', () => {
  it('非法方向、引用状态与页码回落默认值', () => {
    expect(readMediaOrientation('portrait')).toBe('portrait')
    expect(readMediaOrientation('diagonal')).toBe('')
    expect(readMediaOrientation(['square'])).toBe('')
    expect(readMediaUsage('unused')).toBe('unused')
    expect(readMediaUsage('maybe')).toBe('')
    expect(readMediaPage('3')).toBe(3)
    expect(['0', '-2', '1.5', 'x', undefined].map(readMediaPage)).toEqual([1, 1, 1, 1, 1])
  })

  it('最后一页至少为 1，按每页 20 条计算', () => {
    expect([0, 20, 21, 40].map(mediaLastPage)).toEqual([1, 1, 2, 2])
  })
})

describe('查询', () => {
  const filters = { search: '', deleted: 'false', orientation: '', usage: 'used', page: 1 } as const

  it('列表请求省略空条件，始终带回收状态与页大小', () => {
    expect(mediaListQuery(filters)).toEqual({
      page: 1,
      pageSize: 20,
      search: undefined,
      deleted: 'false',
      orientation: undefined,
      usage: 'used',
    })
  })

  it('地址只写非默认值，第一页不写页码', () => {
    expect(mediaAddressQuery(filters)).toEqual({ usage: 'used' })
    expect(mediaAddressQuery({ search: '封面', deleted: 'true', orientation: 'square', usage: '', page: 2 })).toEqual({
      search: '封面',
      deleted: 'true',
      orientation: 'square',
      page: '2',
    })
  })
})

it('上传只接受 8 MB 以内的 JPEG、PNG 与 WebP', () => {
  const limit = 8 * 1024 * 1024
  expect(isAcceptedMediaUpload({ name: 'a.JPG', size: limit })).toBe(true)
  expect(isAcceptedMediaUpload({ name: 'a.webp', size: 1 })).toBe(true)
  expect(isAcceptedMediaUpload({ name: 'a.png', size: limit + 1 })).toBe(false)
  expect(isAcceptedMediaUpload({ name: 'a.gif', size: 1 })).toBe(false)
})

describe('删除结果', () => {
  const refs = { total: 2, page: 1, pageSize: 20, items: [] } as MediaReferences

  it('仍被引用时带上引用与数量', () => {
    expect(referencedRemovalResult(asset, refs, t)).toEqual({
      id: 'a1',
      name: 'cover.png',
      status: 'referenced',
      message: 'admin-media.mediaMessages.referencedResult:{"total":2}',
      references: refs,
    })
  })

  it('失败说明优先取接口返回，区分预检与删除阶段', () => {
    const apiCause = { data: { message: '媒体正在被引用' } }
    expect(failedRemovalResult(asset, apiCause, true, t).message).toBe(
      'admin-media.mediaMessages.removeFailedRecheck:{"message":"媒体正在被引用"}',
    )
    expect(failedRemovalResult(asset, new Error('网络中断'), false, t).message).toBe(
      'admin-media.mediaMessages.checkFailed:{"message":"网络中断"}',
    )
    expect(mediaErrorText('unknown', t)).toBe('admin-media.mediaMessages.operationFailed')
  })
})

it('只有带版本号的历史版本引用拼接版本', () => {
  expect(mediaReferenceLabel({ kind: 'post', title: '', url: '' }, t)).toBe('admin-media.mediaLibrary.kind.post')
  expect(mediaReferenceLabel({ kind: 'revision', title: '', url: '', revision: null }, t)).toBe(
    'admin-media.mediaLibrary.kind.revision',
  )
  expect(mediaReferenceLabel({ kind: 'site-revision', title: '', url: '', revision: 4 }, t)).toBe(
    'admin-media.mediaLibrary.references.versioned:{"label":"admin-media.mediaLibrary.kind.siteRevision","revision":4}',
  )
})
