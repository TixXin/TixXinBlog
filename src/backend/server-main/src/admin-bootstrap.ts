/**
 * @file admin-bootstrap.ts
 * @description 初始化生产管理员，不插入演示内容，也不覆盖已有账号。
 */
import { MikroORM } from '@mikro-orm/postgresql'
import * as argon2 from 'argon2'
import { mikroOrmOptions } from './config/mikro-orm.options'
import { AdminUser } from './entities/admin-user.entity'

async function main(): Promise<void> {
  const username = process.env.ADMIN_DEFAULT_USERNAME?.trim()
  const password = process.env.ADMIN_DEFAULT_PASSWORD
  if (!username || username.length > 64 || !password || password.length < 12 || password === '<required>') {
    throw new Error('请显式配置 ADMIN_DEFAULT_USERNAME 和至少 12 位的 ADMIN_DEFAULT_PASSWORD')
  }
  const orm = await MikroORM.init(mikroOrmOptions)
  try {
    const em = orm.em.fork()
    if (await em.findOne(AdminUser, { username })) {
      throw new Error('该管理员已存在；初始化命令不会覆盖已有密码')
    }
    await em.persistAndFlush(
      em.create(AdminUser, {
        username,
        sessionVersion: 0,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        createdAt: new Date(),
      }),
    )
    process.stdout.write('管理员初始化完成\n')
  } finally {
    await orm.close(true)
  }
}

void main().catch(() => {
  // 数据库错误可能含连接参数，CLI 不输出原始异常。
  process.stderr.write('管理员初始化失败，请检查配置、迁移状态及账号是否已存在\n')
  process.exitCode = 1
})
