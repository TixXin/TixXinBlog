/**
 * @file run-dev.ts
 * @description DevSeeder 执行入口（tsx 运行）：pnpm seed:dev
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroORM } from '@mikro-orm/postgresql'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { DevSeeder } from './dev.seeder'

async function main(): Promise<void> {
  const orm = await MikroORM.init(mikroOrmOptions)
  try {
    await orm.getSeeder().seed(DevSeeder)
  } finally {
    await orm.close(true)
  }
}

void main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
