/**
 * @file stored-display.spec.ts
 * @description 后端返回给页面展示的非错误文字：修订原因、兜底标题、留言规则、审计操作者与站点导入原因按请求语言输出，缺省仍为中文
 * @author TixXin
 * @since 2026-10-19
 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { storedMessage, translateStored, zh } from '..'
import { PostRevisionsService } from '../../../modules/post/post-revisions.service'
import { MediaService } from '../../../modules/media/media.service'
import type { MediaStorage } from '../../../modules/media/media-storage'
import { resolveContentRelations } from '../../../modules/content-relations/content-relations'

const REVISION_SCOPE = 'post.revisionReason.'

describe('按前缀反查持久化中文', () => {
  it('同一中文在不同域含义不同时，按前缀取对应译文', () => {
    expect(translateStored('en', '归档文章', REVISION_SCOPE)).toBe('Archived post')
    expect(translateStored('en', '归档文章', 'audit.action.')).toBe('Archive post')
    expect(storedMessage('数据库尚未就绪', REVISION_SCOPE)).toBeUndefined()
    expect(translateStored('en', '恢复修订 12', REVISION_SCOPE)).toBe('Restored revision 12')
    expect(translateStored('zh-CN', '恢复修订 12', REVISION_SCOPE)).toBe('恢复修订 12')
  })

  it('修订原因以中文写入，字典外的历史原因与种子原因原样返回', () => {
    expect(zh('post.revisionReason.beforeBatch')).toBe('批量操作前')
    expect(zh('post.revisionReason.import')).toBe('从内容包迁入草稿')
    expect(translateStored('en', '初始版本', REVISION_SCOPE)).toBe('Initial version')
    expect(translateStored('en', '开发数据集初次创建', REVISION_SCOPE)).toBe('开发数据集初次创建')
  })
})

describe('修订历史接口', () => {
  const rows = [
    { revision: 3, reason: '恢复修订 1', createdAt: new Date('2026-10-19T08:00:00Z') },
    { revision: 2, reason: '批量操作前', createdAt: new Date('2026-10-18T08:00:00Z') },
    { revision: 1, reason: '博主手写的原因', createdAt: new Date('2026-10-17T08:00:00Z') },
  ]
  const em = {
    findOne: jest.fn(async (_entity: unknown, where: { revision?: number }) =>
      where.revision ? { ...rows[0], snapshot: { contentRaw: '正文' } } : { id: 7 },
    ),
    findAndCount: jest.fn(async () => [rows, rows.length]),
  }
  const service = new PostRevisionsService(em as unknown as EntityManager)

  it('缺省返回中文原文', async () => {
    const result = await service.list(7, 1)
    expect(result.items.map((item) => item.reason)).toEqual(['恢复修订 1', '批量操作前', '博主手写的原因'])
    expect((await service.detail(7, 3)).reason).toBe('恢复修订 1')
  })

  it('英文请求翻译字典内原因，其余原样返回', async () => {
    const result = await service.list(7, 1, 'en')
    expect(result.items.map((item) => item.reason)).toEqual([
      'Restored revision 1',
      'Before batch operation',
      '博主手写的原因',
    ])
    expect((await service.detail(7, 3, 'en')).reason).toBe('Restored revision 1')
  })
})

describe('兜底标题', () => {
  it('媒体引用中站点资料的兜底标题按语言返回', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ id: 'asset' }),
      findAndCount: jest.fn().mockResolvedValue([[{ kind: 'site', revision: 2 }], 1]),
    }
    const service = new MediaService(em as unknown as EntityManager, {} as MediaStorage)
    const zhItem = (await service.references('asset', 1)).items[0]
    expect(zhItem).toMatchObject({ title: '站点头像', url: '/admin/site' })
    expect((await service.references('asset', 1, 'en')).items[0]).toMatchObject({ title: 'Site avatar' })
  })

  it('关联目标缺失时的兜底标题按语言返回', async () => {
    const em = { execute: jest.fn().mockResolvedValue([]) }
    const related = [{ type: 'post' as const, id: 41 }]
    const [zhItem] = await resolveContentRelations(em as unknown as EntityManager, related, true)
    expect(zhItem).toMatchObject({ title: '内容 #41', status: 'missing', available: false })
    const [enItem] = await resolveContentRelations(em as unknown as EntityManager, related, true, 'en')
    expect(enItem).toMatchObject({ title: 'Content #41' })
  })
})
