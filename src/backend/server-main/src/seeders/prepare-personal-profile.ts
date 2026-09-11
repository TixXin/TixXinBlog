/** @file prepare-personal-profile.ts @description 显式整理仍未编辑的初始资料；默认预览，写入前完整备份，不覆盖用户配置 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { SiteSettingsService } from '../modules/site/site-settings.service'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import { DevelopmentDataError } from './seed-development-data'

export async function preparePersonalProfile(args: string[], options: DevelopmentBackupOptions = {}) {
  const apply = args.includes('--apply')
  const confirmIndex = args.indexOf('--confirm')
  if (
    args.some(
      (arg, index) => arg !== '--apply' && arg !== '--confirm' && !(confirmIndex >= 0 && index === confirmIndex + 1),
    ) ||
    (confirmIndex >= 0 && !args[confirmIndex + 1]) ||
    args.filter((arg) => arg === '--apply').length > 1 ||
    args.filter((arg) => arg === '--confirm').length > 1
  )
    throw new DevelopmentDataError('用法：db:dev prepare-profile [--apply --confirm 数据库名]')
  const url = new URL(process.env.DATABASE_URL!)
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    apply &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      process.env.NODE_ENV === 'production' ||
      args[confirmIndex + 1] !== database ||
      ['postgres', 'template0', 'template1'].includes(database))
  )
    throw new DevelopmentDataError('只允许明确确认的本机非生产目标')
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    const service = new SiteSettingsService(orm.em.fork())
    const current = await service.get()
    const initial =
      current.revision === 0 &&
      current.ownerName === 'TixXin' &&
      current.ownerTitle === '前端开发工程师，热爱开源与技术分享' &&
      current.avatar === '/avatar-photo.webp' &&
      current.about?.introduction === '' &&
      !current.about?.sections.length &&
      JSON.stringify(current.socials.map((item) => item.href)) ===
        JSON.stringify(['https://github.com/TixXin', 'https://twitter.com/TixXin', 'mailto:hi@tix.xin'])
    const report = {
      target: { host: url.hostname, port: Number(url.port || 5432), database },
      apply,
      eligible: initial,
      scope: '只整理未编辑的初始姓名、头衔、头像、联系方式及关于页；保留其他配置和全部历史',
      confirmed: { ownerName: 'tixxin' },
      source: '本轮用户确认称呼；站点介绍依据当前仓库能力与用户内容定位',
      revision: current.revision,
    }
    if (!apply || !initial) return { ...report, changed: false }
    if (
      (await orm.getMigrator().getPendingMigrations()).length ||
      (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
    )
      throw new DevelopmentDataError('请先核对并显式执行迁移；资料整理不会隐式迁移')
    const backup = await createDevelopmentBackup(options)
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...values } = current
    void _updatedAt
    void _announcementUpdatedAt
    const saved = await service.save(
      {
        ...values,
        ownerName: 'tixxin',
        ownerTitle: '技术笔记、项目实践与生活记录',
        avatar: '/avatar.svg',
        avatarAlt: '博主头像',
        socials: [],
        about: {
          visible: true,
          introduction:
            '这里主要记录 Web 技术实践，整理 TixXinBlog 的实现与维护过程。项目用于介绍具体实现，图库用于整理图片与来源，生活记录保留独立入口。',
          sections: [],
        },
      },
      '整理已确认称呼与站点定位，收起未经确认的初始资料',
    )
    return { ...report, changed: true, revision: saved.revision, backup: backup.directory }
  } finally {
    await orm.close(true)
  }
}
