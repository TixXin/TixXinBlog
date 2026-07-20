/**
 * @file mikro-orm.config.ts
 * @description MikroORM 配置：PostgreSQL 连接、实体扫描、迁移与 Seeder 路径
 * @author TixXin
 * @since 2026-07-20
 *
 * 工程初始化阶段实体为空，AppModule 尚未注册 MikroOrmModule；
 * 进入实体建模阶段后在 app.module.ts 引入并启用。
 */

import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'

// MikroORM CLI 约定读取默认导出，此文件豁免"禁用默认导出"规则
export default defineConfig({
  clientUrl: process.env.DATABASE_URL ?? 'postgres://tixxin:tixxin@localhost:5432/tixxin_blog',
  entities: ['./dist/entities'],
  entitiesTs: ['./src/entities'],
  extensions: [Migrator, SeedManager],
  migrations: {
    path: './dist/migrations',
    pathTs: './src/migrations',
    // 迁移文件手工命名：YYYYMMDDHHMMSS_<动词>_<对象>（见 development.md §8.1）
    fileName: (timestamp: string, name?: string) => `${timestamp}_${name ?? 'unnamed'}`,
  },
  seeder: {
    path: './dist/seeders',
    pathTs: './src/seeders',
  },
  // 慢查询排查：开发期打印 SQL（见 development.md §13）
  debug: process.env.NODE_ENV === 'development' ? ['query'] : false,
})
