/**
 * @file admin-bootstrap.ts
 * @description 初始化生产管理员，不插入演示内容，也不覆盖已有账号。
 */
import { MikroORM } from '@mikro-orm/postgresql'
import * as argon2 from 'argon2'
import { AdminCliError, assertAdminPassword, describeCliFailure } from './admin-cli'
import { mikroOrmOptions } from './config/mikro-orm.options'
import { AdminUser } from './entities/admin-user.entity'

async function main(): Promise<void> {
  const username = process.env.ADMIN_DEFAULT_USERNAME?.trim()
  if (!username || username.length > 64) {
    throw new AdminCliError('请显式配置 ADMIN_DEFAULT_USERNAME（1–64 个字符）')
  }
  const password = assertAdminPassword(process.env.ADMIN_DEFAULT_PASSWORD, ' ADMIN_DEFAULT_PASSWORD ')
  const orm = await MikroORM.init(mikroOrmOptions)
  try {
    const em = orm.em.fork()
    if (await em.findOne(AdminUser, { username })) {
      throw new AdminCliError('该管理员已存在；初始化命令不会覆盖已有密码')
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

void main().catch((error: unknown) => {
  // 明确的业务错误原样输出；数据库错误可能含连接参数，只输出脱敏提示。
  process.stderr.write(
    `管理员初始化失败：${describeCliFailure(error, '数据库或运行环境异常，请检查连接配置与迁移状态')}\n`,
  )
  process.exitCode = 1
})
