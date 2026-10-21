/** @file maintenance.service.spec.ts @description 维护诊断与媒体完整性核验的纯 mock 单元测试，不访问数据库或媒体目录。 */
import { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { createHash } from 'node:crypto'
import { ContentContext } from '../../entities/content-context.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaStorage } from '../media/media-storage'
import { MaintenanceService } from './maintenance.service'

function setup() {
  const em = { execute: jest.fn(), findOneOrFail: jest.fn(), count: jest.fn(), find: jest.fn() }
  const pendingMigrations = jest.fn()
  const schemaSQL = jest.fn()
  const orm = {
    getMigrator: () => ({ getPendingMigrations: pendingMigrations }),
    schema: { getUpdateSchemaSQL: schemaSQL },
  }
  const storage = { probe: jest.fn(), readIfExists: jest.fn() }
  const service = new MaintenanceService(
    em as unknown as EntityManager,
    orm as unknown as MikroORM,
    storage as unknown as MediaStorage,
  )
  return { em, pendingMigrations, schemaSQL, storage, service }
}

describe('MaintenanceService 维护诊断', () => {
  it.each(['  \n', 'alter table sample add column required text;'])('根据探测返回值计算诊断状态', async (sql) => {
    const { em, pendingMigrations, schemaSQL, storage, service } = setup()
    em.execute.mockResolvedValue([{ '?column?': 1 }])
    em.findOneOrFail.mockResolvedValue({ requireContext: true })
    em.count.mockResolvedValue(12)
    pendingMigrations.mockResolvedValue([{ name: 'MigrationOne' }, { name: 'MigrationTwo' }])
    schemaSQL.mockResolvedValue(sql)
    storage.probe.mockResolvedValue({ readable: true, writable: true, cleaned: true })
    expect(await service.diagnostics()).toMatchObject({
      databaseReachable: true,
      pendingMigrations: 2,
      schemaDrift: sql.trim().length > 0,
      storage: { readable: true, writable: true, cleaned: true },
      mediaRecords: 12,
      contentContextRequired: true,
      runtime: { node: process.version, nodeSupported: Number(process.versions.node.split('.')[0]) === 25 },
    })
    expect(em.findOneOrFail).toHaveBeenCalledWith(ContentContext, { id: 'default' })
    expect(em.count).toHaveBeenCalledWith(MediaAsset, {})
    expect(schemaSQL).toHaveBeenCalledWith({ wrap: false })
  })

  it('连接探测失败时直接失败，不把未知诊断显示为就绪', async () => {
    const { em, storage, pendingMigrations, service } = setup()
    const error = new Error('connection unavailable')
    em.execute.mockRejectedValue(error)
    await expect(service.diagnostics()).rejects.toBe(error)
    expect(storage.probe).not.toHaveBeenCalled()
    expect(pendingMigrations).not.toHaveBeenCalled()
  })
})

describe('MaintenanceService 登记媒体完整性核验', () => {
  it('逐项区分缺失、大小错误、同尺寸摘要错误及不可读，保留软删除标记并继续检查', async () => {
    const { em, storage, service } = setup()
    const bytes = Buffer.from('valid')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const assets = ['valid', 'missing', 'size', 'hash', 'unreadable', 'last-valid'].map((id) => ({
      id,
      storageKey: `/private/media/${id}.webp`,
      sha256,
      byteSize: bytes.length,
      deletedAt: id === 'missing' ? new Date('2026-10-01T00:00:00Z') : null,
    }))
    em.find.mockResolvedValue(assets)
    storage.readIfExists
      .mockResolvedValueOnce(bytes)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(Buffer.from('shorter-or-longer'))
      .mockResolvedValueOnce(Buffer.from('wrong'))
      .mockRejectedValueOnce(new Error('/private/media/permission-denied'))
      .mockResolvedValueOnce(bytes)
    const result = await service.mediaCheck()
    expect(result).toEqual({
      checkedAt: expect.any(String),
      checked: 6,
      problems: [
        { id: 'missing', deleted: true, reason: '文件缺失' },
        { id: 'size', deleted: false, reason: '完整性不符' },
        { id: 'hash', deleted: false, reason: '完整性不符' },
        { id: 'unreadable', deleted: false, reason: '文件不可读' },
      ],
    })
    expect(storage.readIfExists).toHaveBeenCalledTimes(6)
    expect(storage.readIfExists).toHaveBeenLastCalledWith('/private/media/last-valid.webp')
    expect(JSON.stringify(result)).not.toMatch(/private|permission-denied|storageKey|sha256/)
    expect(em.find).toHaveBeenCalledWith(MediaAsset, {}, expect.objectContaining({ orderBy: { id: 'asc' } }))
  })

  it('空库存返回真实零值，不探测额外文件', async () => {
    const { em, storage, service } = setup()
    em.find.mockResolvedValue([])
    await expect(service.mediaCheck()).resolves.toMatchObject({ checked: 0, problems: [] })
    expect(storage.readIfExists).not.toHaveBeenCalled()
  })
})
