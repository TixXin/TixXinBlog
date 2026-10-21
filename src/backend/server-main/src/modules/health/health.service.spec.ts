/**
 * @file health.service.spec.ts
 * @description 数据库健康检查服务的单元测试
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('数据库连通时正常返回', async () => {
    const execute = jest.fn().mockResolvedValue([{ '?column?': 1 }])
    const em = { getConnection: () => ({ execute }) } as unknown as EntityManager
    const service = new HealthService(em)

    await expect(service.checkDatabase()).resolves.toBeUndefined()
    expect(execute).toHaveBeenCalledWith('select 1')
  })

  it('数据库异常时向上抛出错误', async () => {
    const error = new Error('database connection failed')
    const execute = jest.fn().mockRejectedValue(error)
    const em = { getConnection: () => ({ execute }) } as unknown as EntityManager
    const service = new HealthService(em)

    await expect(service.checkDatabase()).rejects.toThrow('database connection failed')
    expect(execute).toHaveBeenCalledWith('select 1')
  })
})
