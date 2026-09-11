/** @file content-relations.spec.ts @description 有序去重、自关联、失效目标保留和公开隐私投影。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { normalizeContentRelations, resolveContentRelations, validateContentRelations } from './content-relations'
describe('有向内容关联', () => {
  it('保留首次顺序去重，拒绝自身、未知类型和超限', () => {
    expect(
      normalizeContentRelations([
        { type: 'gallery', id: 2 },
        { type: 'post', id: 1 },
        { type: 'gallery', id: 2 },
      ]),
    ).toEqual([
      { type: 'gallery', id: 2 },
      { type: 'post', id: 1 },
    ])
    expect(() => normalizeContentRelations([{ type: 'post', id: 1 }], { type: 'post', id: 1 })).toThrow('自身')
    expect(() => normalizeContentRelations([{ type: 'moment', id: 1 }])).toThrow('不合法')
    expect(() =>
      normalizeContentRelations(Array.from({ length: 13 }, (_, id) => ({ type: 'post', id: id + 1 }))),
    ).toThrow('12')
  })
  it('公开结果不包含草稿标题、软删除或缺失目标，管理结果明确标记', async () => {
    const em = {
      execute: jest.fn().mockResolvedValue([
        { type: 'post', id: 1, title: '公开文章', slug: 'public-entry', status: 'published', deleted_at: null },
        { type: 'post', id: 2, title: '保密草稿标题', status: 'draft', deleted_at: null },
        { type: 'post', id: 3, title: '已删除标题', status: 'published', deleted_at: new Date() },
      ]),
    } as unknown as EntityManager
    const input = [1, 2, 3, 4].map((id) => ({ type: 'post' as const, id }))
    expect(await resolveContentRelations(em, input)).toEqual([
      { type: 'post', id: 1, title: '公开文章', url: '/articles/public-entry' },
    ])
    expect(
      (await resolveContentRelations(em, input, true)).map((item) => [item.id, item.status, item.available]),
    ).toEqual([
      [1, 'published', true],
      [2, 'draft', true],
      [3, 'deleted', false],
      [4, 'missing', false],
    ])
  })
  it('新增缺失目标被拒绝，当前已有失效关系可以保留', async () => {
    const em = { execute: jest.fn().mockResolvedValue([]) } as unknown as EntityManager
    const target = [{ type: 'project' as const, id: 42 }]
    await expect(validateContentRelations(em, target, [])).rejects.toThrow('不存在或已删除')
    await expect(validateContentRelations(em, target, target)).resolves.toEqual(target)
  })
})
