/**
 * @file health.service.ts
 * @description 数据库健康检查服务：探针查询与连通性验证
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

@Injectable()
export class HealthService {
  constructor(private readonly em: EntityManager) {}

  /** 检测数据库连通性 */
  async checkDatabase(): Promise<void> {
    await this.em.getConnection().execute('select 1')
  }
}
