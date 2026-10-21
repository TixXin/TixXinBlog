/**
 * @file backup-operations.spec.ts
 * @description 内容包导入与运维入口的英文文案回归：异常 key 与业务码、持久化导入计划的读取时翻译与确认哈希不变
 * @author TixXin
 * @since 2026-10-19
 */
import { ConflictException, HttpException, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ErrorCode } from '../../constants/error-codes'
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter'
import { translate, translateStored, zh, type LocalizedMessage } from '..'
import { OperationsController } from '../../../modules/operations/operations.controller'
import { OperationsService } from '../../../modules/operations/operations.service'
import { MaintenanceController } from '../../../modules/backup/maintenance.controller'
import { MaintenanceService } from '../../../modules/backup/maintenance.service'
import { guestbookImportPlan } from '../../../modules/backup/content-guestbook-plan'
import { ContentImportService } from '../../../modules/backup/content-import.service'
import { packageHash } from '../../../modules/backup/content-package'
import type { PackageGuestbook } from '../../../modules/backup/content-package'
import type { ContentImport, ContentImportPlan } from '../../../entities/content-import.entity'
import type { MediaStorage } from '../../../modules/media/media-storage'

function respond(exception: unknown, locale?: string) {
  const sent: { status?: number; body?: Record<string, unknown> } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: Record<string, unknown>) {
      sent.body = body
    },
  }
  const headers: Record<string, string> = locale ? { 'accept-language': locale } : {}
  const request = { method: 'POST', path: '/api/v1/admin/operations', headers }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return sent
}

async function caught(work: () => unknown): Promise<HttpException> {
  try {
    await work()
  } catch (error) {
    return error as HttpException
  }
  throw new Error('预期抛出异常')
}

const localized = (error: HttpException) => error.getResponse() as LocalizedMessage

beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined))
afterEach(() => jest.restoreAllMocks())

describe('运维入口英文文案', () => {
  const taskId = 'bc011b89-3150-4058-bdaf-b1b17df27ce4'
  function controller(task?: Record<string, unknown>) {
    const transaction = {
      execute: jest.fn((sql: string) => (sql.includes('operation_control') ? [{ external_paused: false }] : [task])),
    }
    const em = {
      execute: jest.fn(() => (task ? [task] : [])),
      transactional: jest.fn((work: (em: unknown) => unknown) => work(transaction)),
    }
    return new OperationsController(new OperationsService(em as unknown as EntityManager))
  }

  it('任务不存在：默认中文，en 返回英文', async () => {
    const error = await caught(() => controller().task(taskId))
    expect(error.message).toBe('任务不存在或记录已清理')
    expect(respond(error).body).toMatchObject({ message: '任务不存在或记录已清理' })
    expect(respond(error, 'en').body).toMatchObject({
      message: 'The task does not exist or its record has been cleaned up',
    })
  })

  it('任务状态已变化登记 RevisionConflict，重试口令保持中文', async () => {
    const error = await caught(() =>
      controller({ id: taskId, state: 'failed', attempts: 2, kind: 'mail' }).retry(taskId, {
        expectedState: 'failed',
        expectedAttempts: 1,
        acknowledgement: '重试失败任务',
      } as never),
    )
    expect(error).toBeInstanceOf(ConflictException)
    expect(error.message).toBe('任务状态已变化，请刷新后核对')
    const sent = respond(error, 'en')
    expect(sent.status).toBe(409)
    expect(sent.body).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: 'The task status has changed. Refresh and check again.',
    })
  })
})

describe('内容包导入英文文案', () => {
  it('留言引用不完整：异常携带 key，英文可渲染', () => {
    const broken = [
      { sourceId: 2, replyToId: 1, author: 'Lin', avatar: '', content: '回复', isOwner: false, deleted: false },
    ] as unknown as PackageGuestbook[]
    let error: HttpException | undefined
    try {
      guestbookImportPlan([], broken, 'copy')
    } catch (thrown) {
      error = thrown as HttpException
    }
    expect(error?.message).toBe('留言引用不完整，不能生成导入预览')
    const body = localized(error!)
    expect(translate('en', body.messageKey, body.messageParams)).toBe(
      'Guestbook reply references are incomplete, so an import preview cannot be generated.',
    )
  })

  it('维护诊断原因按请求语言返回', async () => {
    const em = { find: jest.fn(async () => [{ id: 'gone', storageKey: 'gone.webp', deletedAt: null }]) }
    const storage = { readIfExists: jest.fn(async () => null) }
    const maintenance = new MaintenanceController(
      new MaintenanceService(em as unknown as EntityManager, {} as never, storage as unknown as MediaStorage),
    )
    await expect(maintenance.mediaCheck()).resolves.toMatchObject({ problems: [{ reason: '文件缺失' }] })
    await expect(maintenance.mediaCheck('en')).resolves.toMatchObject({ problems: [{ reason: 'File missing' }] })
  })

  it('持久化的组合原因、带参数错误与 lastError 可反查翻译', () => {
    expect(zh('backup.planPostCopyNewSlug')).toBe('创建新的草稿副本，现有内容保留；原地址占用，使用新的地址标识')
    expect(translateStored('en', '创建新草稿；原地址占用，使用新的地址标识')).toBe(
      'Create a new draft; the original URL is taken, so a new URL slug is used',
    )
    expect(translateStored('en', '缺少媒体 a1b2 的文件，请使用包含图片的内容包或先完成媒体恢复')).toBe(
      'The file for media a1b2 is missing. Use a content package that includes images or restore the media first.',
    )
    expect(translateStored('en', '关联内容 post:7 去重后会指向自身，请选择复制策略')).toBe(
      'Related content post:7 would point to itself after deduplication. Choose the copy strategy.',
    )
    expect(translateStored('en', '预览已过期，请重新选择文件')).toBe(
      'The preview has expired. Please choose the file again.',
    )
    expect(translateStored('zh-CN', '预览已过期，请重新选择文件')).toBe('预览已过期，请重新选择文件')
  })

  it('导入票据 DTO 返回翻译副本，确认哈希与实体中的中文计划不变', async () => {
    const plan = {
      basis: 'basis-hash',
      ready: false,
      errors: [zh('backup.planMediaUnreadable', { id: 'm1' })],
      posts: [{ sourceId: 1, title: '春日', skip: false, slug: 'spring', reason: zh('backup.planPostCreateNewSlug') }],
      flashes: [],
      moments: [],
      guestbook: [{ sourceId: 3, title: '你好', skip: false, reason: zh('backup.planGuestbookPending') }],
      gallery: [],
      projects: [],
      links: [{ sourceId: 4, title: '友站', skip: true, reason: zh('backup.planLinkSkipSame') }],
      media: [],
      counts: {},
    } as unknown as ContentImportPlan
    const snapshot = JSON.parse(JSON.stringify(plan)) as ContentImportPlan
    const job = {
      id: 'ticket-1',
      plan,
      strategy: 'copy',
      includeSettings: false,
      createdAt: new Date('2026-10-19T00:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      lastError: zh('backup.targetChanged'),
    } as unknown as ContentImport
    const em = { execute: jest.fn(async () => []), findOne: jest.fn(async () => job) }
    const service = new ContentImportService(
      em as unknown as EntityManager,
      ...([{}, {}, {}, {}, {}, {}] as [never, never, never, never, never, never]),
    )
    const admin = { id: 'admin', sessionVersion: 1, sessionId: 'session' }

    const english = await service.get('ticket-1', admin, 'en')
    expect(english.plan.errors).toEqual(['Media m1 cannot be read right now'])
    expect(english.plan.posts[0]!.reason).toBe(
      'Create a new draft; the original URL is taken, so a new URL slug is used',
    )
    expect(english.plan.guestbook[0]!.reason).toMatch(/^Import as a pending message/)
    expect(english.plan.links[0]!.reason).toBe(
      'Skip the link with the same canonical URL; existing content stays unchanged',
    )
    expect(english.error).toBe('The target content or settings have changed. Preview again before confirming.')
    expect(english.confirmation).toBe(packageHash(snapshot))
    expect(job.plan).toEqual(snapshot)

    const chinese = await service.get('ticket-1', admin)
    expect(chinese.plan.posts[0]!.reason).toBe('创建新草稿；原地址占用，使用新的地址标识')
    expect(chinese.error).toBe('目标内容或配置已变化，请重新预览后确认')
    expect(chinese.confirmation).toBe(english.confirmation)
  })

  it('上传标识冲突登记 SubmissionConflict', async () => {
    const em = {
      findOne: jest.fn(async () => ({ id: 'r', actorId: 'other', fileHash: 'x', strategy: 'skip' })),
    }
    const service = new ContentImportService(
      em as unknown as EntityManager,
      ...([{}, {}, {}, {}, {}, {}] as [never, never, never, never, never, never]),
    )
    const error = await caught(() =>
      service.preview(
        { buffer: Buffer.from('{}'), originalname: 'blog.json' },
        { requestId: 'r', strategy: 'skip', includeSettings: false },
        { id: 'admin', sessionVersion: 1, sessionId: 's' },
      ),
    )
    expect(error.message).toBe('上传标识已经使用，请重新选择文件')
    expect(respond(error, 'en').body).toMatchObject({
      code: ErrorCode.SubmissionConflict,
      message: 'This upload ID has already been used. Please choose the file again.',
    })
  })
})
