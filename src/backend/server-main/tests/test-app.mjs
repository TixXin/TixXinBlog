/**
 * @file test-app.mjs
 * @description 浏览器验收专用隔离后端；临时数据库名称完全由程序生成，结束后仅清理该库
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createMediaTestDirectory } from './media-directory.mjs'
import { createFixtureBackupDirectory } from './fixture-backup-directory.mjs'
import { getHttpTestPort } from './http-test-port.mjs'

const require = createRequire(import.meta.url)
const backendDirectory = fileURLToPath(new URL('../', import.meta.url))
let fixtureRequested = false

/**
 * 创建隔离应用。options.setupWizard 为 true 时不预置管理员，并配置随机 SETUP_TOKEN，
 * 供浏览器初始化向导验收；其余样本照常写入，缺省行为不变。
 */
export async function createBrowserTestApp(corsOrigin, options = {}) {
  const setupWizard = options.setupWizard === true
  // Nest 模块缓存会保留首次数据库配置；必须在任何配置读取和建库之前拒绝同进程复建。
  assert.equal(fixtureRequested, false, '每个测试进程只允许创建一次隔离应用；其他场景请使用独立进程')
  fixtureRequested = true
  process.chdir(backendDirectory)
  require('reflect-metadata')
  require('../dist/config/environment.js').loadLocalEnvironment()
  const sourceUrl = new URL(process.env.DATABASE_URL)
  assert(['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname), '仅允许使用本机数据库创建浏览器测试库')
  const { MikroORM } = require('@mikro-orm/postgresql')
  const { mikroOrmOptions } = require('../dist/config/mikro-orm.options.js')
  const admin = await MikroORM.init({ ...mikroOrmOptions, debug: false })
  const mediaDirectory = createMediaTestDirectory()
  const backupDirectory = createFixtureBackupDirectory()
  const database = `tixxin_browser_${Date.now()}_${process.pid}`
  assert(/^tixxin_browser_\d+_\d+$/.test(database))
  let app
  let created = false
  const close = async () => {
    if (app) await app.close()
    if (created) {
      assert(/^tixxin_browser_\d+_\d+$/.test(database))
      await admin.em.getConnection().execute(`drop database "${database}" with (force)`)
    }
    await admin.close(true)
    mediaDirectory.cleanup()
    backupDirectory.cleanup()
  }
  try {
    await admin.em.getConnection().execute(`create database "${database}"`)
    created = true
    sourceUrl.pathname = `/${database}`
    Object.assign(process.env, {
      DATABASE_URL: sourceUrl.toString(),
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MEDIA_DIRECTORY: mediaDirectory.directory,
      JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
      CORS_ORIGIN: corsOrigin,
      // 缺省模式显式清空，避免本机环境文件里的令牌意外打开向导。
      SETUP_TOKEN: setupWizard ? randomBytes(32).toString('hex') : '',
    })
    const { NestFactory } = require('@nestjs/core')
    const { AppModule } = require('../dist/app.module.js')
    const { configureApplication } = require('../dist/bootstrap.js')
    app = await NestFactory.create(AppModule, { logger: false })
    configureApplication(app)
    const orm = app.get(MikroORM)
    orm.config.set('migrations', { ...orm.config.get('migrations'), snapshot: false })
    await orm.getMigrator().up()
    const em = orm.em.fork()
    const { AdminUser } = require('../dist/entities/admin-user.entity.js')
    const { Post } = require('../dist/entities/post.entity.js')
    const { PostTag } = require('../dist/entities/post-tag.entity.js')
    const { PostFolder } = require('../dist/entities/post-folder.entity.js')
    const { parsePostMarkdown } = require('../dist/modules/post/post-markdown.js')
    const argon2 = require('argon2')
    const sharp = require('sharp')
    const mediaSample = (
      await sharp({ create: { width: 24, height: 18, channels: 3, background: '#5688dd' } })
        .png()
        .toBuffer()
    ).toString('base64')
    const username = 'e2e-admin'
    const password = randomBytes(18).toString('base64url')
    const accountUsername = 'e2e-password-admin'
    if (!setupWizard) {
      em.create(AdminUser, { username, passwordHash: await argon2.hash(password), createdAt: new Date() })
      em.create(AdminUser, {
        username: accountUsername,
        passwordHash: await argon2.hash(password),
        createdAt: new Date(),
      })
    }
    const tag = em.create(PostTag, { label: '示例标签', slug: '示例标签', color: 'sky', count: 106 })
    em.create(PostFolder, { label: '示例专栏' })
    for (let index = 0; index < 106; index += 1) {
      const contentRaw = '# 正文标题\n\n公开的测试正文。\n\n```text\n<div>代码示例</div>\n```'
      const post = em.create(Post, {
        title: `分页样本 ${String(index).padStart(3, '0')}`,
        summary: '用于隔离浏览器验收',
        contentRaw,
        contentSections: parsePostMarkdown(contentRaw),
        category: 'tech',
        folder: '示例专栏',
        readTimeMinutes: 1,
        status: 'published',
        publishedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 0,
        likes: 0,
        commentCount: 0,
        pinned: false,
      })
      if (index === 105) {
        // 保留旧文章块渲染路径，专门验证未知语言安全回退与标题样式。
        post.contentRaw = undefined
        post.contentSections = [
          { type: 'heading', level: 2, id: 'legacy-h2', text: '旧格式二级标题' },
          { type: 'paragraph', text: '正文样式验收。' },
          { type: 'heading', level: 3, id: 'legacy-h3', text: '旧格式三级标题' },
          { type: 'code', language: 'unknown-e2e-language', text: '<img src=x onerror="alert(1)">' },
          { type: 'code', language: 'javascript', text: 'const sharedPrefixValue = "first"' },
          { type: 'code', language: 'javascript', text: 'const sharedPrefixValue = "second"' },
        ]
      }
      post.tags.add(tag)
    }
    await em.flush()
    await app.listen(await getHttpTestPort(), '127.0.0.1')
    return {
      origin: await app.getUrl(),
      // 向导模式下账号尚不存在：用例按 setupToken 自行创建，用户名与密码不对外提供。
      username: setupWizard ? undefined : username,
      password: setupWizard ? undefined : password,
      accountUsername: setupWizard ? undefined : accountUsername,
      setupToken: setupWizard ? process.env.SETUP_TOKEN : undefined,
      mediaSample,
      testOrm: orm,
      backupOptions: { backupRoot: backupDirectory.directory },
      close,
      useProductionEnvironmentForPerformance: () => {
        assert(app, '隔离应用已停止')
        assert(/^tixxin_browser_\d+_\d+$/.test(orm.config.get('dbName')))
        const { ConfigService } = require('@nestjs/config')
        const config = app.get(ConfigService)
        const previous = config.get('NODE_ENV')
        const previousEnvironment = process.env.NODE_ENV
        assert.equal(previous, 'test', '只能在隔离样本准备完成后切换性能验收环境')
        // ConfigService.set 同时更新 process.env；恢复句柄必须在性能验收 finally 中调用。
        config.set('NODE_ENV', 'production')
        let restored = false
        return () => {
          if (restored) return
          restored = true
          config.set('NODE_ENV', previous)
          if (previousEnvironment === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = previousEnvironment
        }
      },
      stopServices: async () => {
        await app?.close()
        app = undefined
      },
    }
  } catch (error) {
    await close()
    throw error
  }
}
