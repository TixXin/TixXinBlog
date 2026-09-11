/** @file prepare-personal-profile.ts @description 显式整理仍未编辑的初始资料；默认预览，写入前完整备份，不覆盖用户配置 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { SiteSettingsService } from '../modules/site/site-settings.service'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import { DevelopmentDataError } from './seed-development-data'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { SiteSettings } from '../entities/site-settings.entity'
import { lockMedia } from '../modules/media/media-references'
import {
  EMPTY_INITIAL_ABOUT,
  INITIAL_PROFILE_REASON,
  LEGACY_INITIAL_SITE_VALUES,
  SAFE_INITIAL_PROFILE_REASON,
  SAFE_INITIAL_SITE_VALUES,
} from '../modules/site/initial-profile'

async function eligibleInitialProfile(em: EntityManager) {
  const [match] = await em.execute<{ eligible: boolean }[]>(
    `select exists(select 1 from site_settings s join site_settings_revision r on r.revision=s.revision
      where s.id='default' and (
        (s.revision=0 and not exists(select 1 from site_settings_revision where revision=1) and r.reason=? and s."values"-'about'=r."values"-'about' and r."values"-'about'=?::jsonb
          and coalesce(s."values"->'about',?::jsonb)=?::jsonb and coalesce(r."values"->'about',?::jsonb)=?::jsonb)
        or (s.revision=1 and r.reason=? and s."values"=r."values" and s."values"=?::jsonb)
      )) as eligible`,
    [
      INITIAL_PROFILE_REASON,
      JSON.stringify(LEGACY_INITIAL_SITE_VALUES),
      JSON.stringify(EMPTY_INITIAL_ABOUT),
      JSON.stringify(EMPTY_INITIAL_ABOUT),
      JSON.stringify(EMPTY_INITIAL_ABOUT),
      JSON.stringify(EMPTY_INITIAL_ABOUT),
      SAFE_INITIAL_PROFILE_REASON,
      JSON.stringify(SAFE_INITIAL_SITE_VALUES),
    ],
  )
  return match?.eligible === true
}

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
    const initial = await eligibleInitialProfile(orm.em.fork())
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
    const saved = await orm.em.fork().transactional(async (em) => {
      await lockMedia(em)
      const latest = await em.findOneOrFail(
        SiteSettings,
        { id: 'default' },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (latest.revision !== current.revision || !(await eligibleInitialProfile(em))) return null
      return new SiteSettingsService(em).save(
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
    })
    if (!saved)
      return {
        ...report,
        eligible: false,
        changed: false,
        backup: backup.directory,
        reason: '资料在备份期间已改变，保留当前配置',
      }
    return { ...report, changed: true, revision: saved.revision, backup: backup.directory }
  } finally {
    await orm.close(true)
  }
}
