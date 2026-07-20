/**
 * @file flashRepositoryLocal.test.ts
 * @description LocalFlashRepository（localStorage 实现）单元测试：CRUD、排序、归档、搜索与评论
 * @author TixXin
 * @since 2026-07-20
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LocalFlashRepository } from '../../app/features/flash/repository.local'
import type { FlashNote } from '../../app/features/flash/types'

const USER = 'test-user'

function createRepo() {
  return new LocalFlashRepository()
}

describe('LocalFlashRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('create 后 list 返回该条闪念，且默认补齐 memo 类型与空图片', async () => {
    const repo = createRepo()
    const created = await repo.create(USER, { content: '第一条', tags: ['t1'] })

    expect(created.id).toBeTruthy()
    expect(created.type).toBe('memo')
    expect(created.images).toEqual([])

    const list = await repo.list(USER)
    expect(list).toHaveLength(1)
    expect(list[0]!.content).toBe('第一条')
  })

  it('list 按 createdAt 倒序，置顶条目前置', async () => {
    const repo = createRepo()
    await repo.create(USER, { content: '旧', tags: [], createdAt: '2026-01-01T00:00:00Z' })
    await repo.create(USER, { content: '新', tags: [], createdAt: '2026-03-01T00:00:00Z' })
    await repo.create(USER, { content: '置顶的', tags: [], createdAt: '2026-02-01T00:00:00Z', isPinned: true })

    const list = await repo.list(USER)
    expect(list.map((n) => n.content)).toEqual(['置顶的', '新', '旧'])
  })

  it('setArchived 后从 list 消失并出现在 listArchived', async () => {
    const repo = createRepo()
    const note = await repo.create(USER, { content: '待归档', tags: [] })
    await repo.setArchived(note.id, true)

    expect(await repo.list(USER)).toHaveLength(0)
    const archived = await repo.listArchived(USER)
    expect(archived).toHaveLength(1)
    expect(archived[0]!.id).toBe(note.id)
  })

  it('update 可修改正文与标签并刷新 updatedAt', async () => {
    const repo = createRepo()
    const note = await repo.create(USER, { content: '原文', tags: ['a'], createdAt: '2026-01-01T00:00:00Z' })
    const updated = await repo.update(note.id, { content: '改后', tags: ['b'] })

    expect(updated.content).toBe('改后')
    expect(updated.tags).toEqual(['b'])
    expect(updated.updatedAt > note.createdAt).toBe(true)
  })

  it('update 不存在的 id 时 reject', async () => {
    const repo = createRepo()
    await expect(repo.update('note-missing', { content: 'x' })).rejects.toThrow('not found')
  })

  it('remove 删除指定闪念', async () => {
    const repo = createRepo()
    const a = await repo.create(USER, { content: 'A', tags: [] })
    await repo.create(USER, { content: 'B', tags: [] })

    await repo.remove(a.id)
    const list = await repo.list(USER)
    expect(list).toHaveLength(1)
    expect(list[0]!.content).toBe('B')
  })

  it('search 命中正文与标签且大小写不敏感', async () => {
    const repo = createRepo()
    await repo.create(USER, { content: '学习 Vue 源码', tags: [] })
    await repo.create(USER, { content: '晚饭吃什么', tags: ['VUE'] })
    await repo.create(USER, { content: '无关内容', tags: ['life'] })

    const hits = await repo.search(USER, 'vue')
    expect(hits).toHaveLength(2)
  })

  it('toggleLike 在 0 与 1 之间切换', async () => {
    const repo = createRepo()
    const note = await repo.create(USER, { content: '赞我', tags: [] })

    expect((await repo.toggleLike(note.id)).likes).toBe(1)
    expect((await repo.toggleLike(note.id)).likes).toBe(0)
  })

  it('addComment / removeComment 维护评论列表', async () => {
    const repo = createRepo()
    const note = await repo.create(USER, { content: '有评论的', tags: [] })
    const comment = await repo.addComment(note.id, {
      authorId: 'guest',
      authorName: '路人',
      authorAvatar: '/avatar.svg',
      content: '不错',
    })

    let list = await repo.list(USER)
    expect(list[0]!.comments).toHaveLength(1)
    expect(list[0]!.comments[0]!.content).toBe('不错')

    await repo.removeComment(note.id, comment.id)
    list = await repo.list(USER)
    expect(list[0]!.comments).toHaveLength(0)
  })

  it('读取旧版缺字段数据时 normalize 补全默认值', async () => {
    const legacy = [
      {
        id: 'legacy-1',
        userId: USER,
        content: '旧版数据',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    window.localStorage.setItem(`flash:notes:${USER}`, JSON.stringify(legacy))

    const repo = createRepo()
    const list = await repo.list(USER)
    const note = list[0] as FlashNote
    expect(note.likes).toBe(0)
    expect(note.comments).toEqual([])
    expect(note.type).toBe('memo')
    expect(note.images).toEqual([])
    expect(note.isArchived).toBe(false)
  })
})
