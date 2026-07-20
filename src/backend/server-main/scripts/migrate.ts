/**
 * @file migrate.ts
 * @description 迁移工具（tsx 运行）：initial / create <name> / up / list
 * @author TixXin
 * @since 2026-07-20
 *
 * 用 tsx + Migrator API 替代 mikro-orm CLI，避免 CLI 对 ts-node 的依赖。
 * 用法：pnpm migration:up | pnpm migration:create <name> | pnpm exec tsx scripts/migrate.ts initial
 */

import { MikroORM } from '@mikro-orm/postgresql'
import { mikroOrmOptions } from '../src/config/mikro-orm.options'

async function main(): Promise<void> {
  const [command, name] = process.argv.slice(2)
  const orm = await MikroORM.init(mikroOrmOptions)
  const migrator = orm.getMigrator()

  try {
    switch (command) {
      case 'initial': {
        const result = await migrator.createInitialMigration()
        process.stdout.write(`generated: ${result.fileName}\n`)
        break
      }
      case 'create': {
        if (!name) throw new Error('用法: migrate.ts create <name>')
        const result = await migrator.createMigration(undefined, false, false, name)
        process.stdout.write(`generated: ${result.fileName}\n`)
        break
      }
      case 'up': {
        const executed = await migrator.up()
        process.stdout.write(`executed ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}\n`)
        break
      }
      case 'list': {
        const pending = await migrator.getPendingMigrations()
        const done = await migrator.getExecutedMigrations()
        process.stdout.write(`executed: ${done.length}, pending: ${pending.length}\n`)
        break
      }
      case 'check': {
        // CI 门禁(development.md §8.1):迁移全部应用后,实体定义与数据库 schema 必须零漂移
        const pending = await migrator.getPendingMigrations()
        if (pending.length > 0) {
          throw new Error(`存在 ${pending.length} 个未应用的迁移,请先执行 migration:up`)
        }
        const diff = (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
        if (diff) {
          process.stderr.write(`实体与数据库 schema 存在漂移,请生成新迁移:\n${diff}\n`)
          throw new Error('migration check 失败')
        }
        process.stdout.write('migration check 通过:无待应用迁移,schema 与实体一致\n')
        break
      }
      default:
        throw new Error(`未知命令: ${command ?? '(空)'}，可用: initial | create <name> | up | list | check`)
    }
  } finally {
    await orm.close(true)
  }
}

void main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
