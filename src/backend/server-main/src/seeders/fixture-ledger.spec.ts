/** @file fixture-ledger.spec.ts @description 新增缺省字段不把既有样本误判为人工编辑，真实改动仍保护 */
import { fixtureHash } from './fixture-ledger'
describe('样本指纹兼容', () => {
  it('空关联与空媒体说明兼容升级前指纹', () => {
    const post = { id: 1, title: '原文', status: 'published' }
    expect(fixtureHash({ ...post, related_content: [] })).toBe(fixtureHash(post))
    expect(fixtureHash({ ...post, related_content: [{ type: 'post', id: 2 }] })).not.toBe(fixtureHash(post))
    const media = { id: 'image', storage_key: 'image.webp', alt: '' }
    expect(fixtureHash({ ...media, description: '' })).toBe(fixtureHash(media))
    expect(fixtureHash({ ...media, description: '来源说明' })).not.toBe(fixtureHash(media))
  })
  it('既有项目与图库的空说明仍参与指纹', () => {
    expect(fixtureHash({ id: 1, description: '' })).not.toBe(fixtureHash({ id: 1 }))
  })
})
