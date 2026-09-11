/** @file gallery.test.ts @description 图库查询与恢复副本边界，不将空分类、未知日期或旧内容库混为一谈 */
import { describe, expect, it } from 'vitest'
import { galleryPhotoId, galleryQuery } from '../../app/features/gallery/query'
import { galleryForm, galleryPayload, galleryUrlError, parseGalleryRecovery } from '../../app/features/gallery/editor'
describe('图库 URL 与恢复数据', () => {
  it('外链保留签名大小写和编码，来源切换只提交选中字段', () => {
    const url = 'https://images.example.org/Photo?tag=A&tag=B&sig=Ab%2Fc#Frame'
    const form = galleryForm({ mediaId: '12345678-1234-4123-a123-123456789abc', source: 'external', externalUrl: url })
    expect(galleryUrlError(url)).toBe('')
    expect(galleryUrlError('http://images.example.org/image?id=1')).toBe('')
    expect(galleryPayload(form)).toMatchObject({ mediaId: null, externalUrl: url })
    form.source = 'media'
    expect(galleryPayload(form)).toMatchObject({ mediaId: form.mediaId, externalUrl: null })
    expect(form.externalUrl).toBe(url)
    for (const invalid of [
      'https:///host/a',
      '//example.org/a',
      'javascript:alert(1)',
      'https://a:b@example.org/a',
      'https://example.org/a\nb',
      'https://example.org/a b',
      `https://example.org/%2561pi/v1/media/${form.mediaId}.webp`,
    ])
      expect(galleryUrlError(invalid)).toBeTruthy()
  })
  it('旧恢复副本升级为媒体来源，新副本完整保留两套输入及未知提交', () => {
    const form = galleryForm({
      source: 'external',
      externalUrl: 'https://example.org/Image?key=Ab%2FC',
      mediaId: '12345678-1234-4123-a123-123456789abc',
    })
    const copy = {
      version: 2,
      context: 'library',
      id: null,
      revision: null,
      requestId: '12345678-1234-4123-a123-123456789abc',
      form,
      pendingCreate: form,
      savedAt: '2026-09-11',
    }
    expect(parseGalleryRecovery(JSON.stringify(copy))?.form).toEqual(form)
    expect(parseGalleryRecovery(JSON.stringify(copy))?.pendingCreate).toEqual(form)
    const { source, externalUrl, ...oldForm } = form
    void source
    void externalUrl
    expect(
      parseGalleryRecovery(JSON.stringify({ ...copy, version: 1, form: oldForm, pendingCreate: oldForm }))?.form,
    ).toMatchObject({ source: 'media', externalUrl: '', mediaId: form.mediaId })
  })
  it('区分全部与未分类并规范页码和照片编号', () => {
    expect(galleryQuery({}).category).toBeUndefined()
    expect(galleryQuery({ category: '', q: '  巷口 ', page: '2' })).toEqual({
      category: '',
      q: '巷口',
      page: 2,
      pageSize: 12,
    })
    for (const page of ['-1', '1.5', '10001', 'abc']) expect(galleryQuery({ page }).page).toBe(1)
    expect(galleryPhotoId('42')).toBe(42)
    for (const id of ['01', '-1', '3e2', '9007199254740992', ['1']]) expect(galleryPhotoId(id)).toBeNull()
  })
  it('拍摄信息可缺省，恢复副本只保留白名单字段及原提交', () => {
    const value = {
      version: 1,
      context: 'content-one',
      id: null,
      revision: null,
      requestId: '12345678-1234-4123-a123-123456789abc',
      form: { ...galleryForm(), title: '雨后的街角', injected: true },
      pendingCreate: null,
      savedAt: '2026-09-10',
    }
    const recovery = parseGalleryRecovery(JSON.stringify(value))!
    expect(recovery.form.takenOn).toBeNull()
    expect(recovery.context).toBe('content-one')
    expect('injected' in recovery.form).toBe(false)
    expect(parseGalleryRecovery(JSON.stringify({ ...value, form: { ...value.form, sortOrder: 0.5 } }))).toBeNull()
    expect(
      parseGalleryRecovery(JSON.stringify({ ...value, pendingCreate: { ...value.form, status: 'hidden' } })),
    ).toBeNull()
  })
})
