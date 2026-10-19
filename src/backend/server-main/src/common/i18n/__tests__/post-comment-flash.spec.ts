/**
 * @file post-comment-flash.spec.ts
 * @description 文章、评论与闪念的异常文案按 Accept-Language 输出英文；批量操作持久化的中文原因与结果按请求语言翻译
 * @author TixXin
 * @since 2026-10-19
 */
import 'reflect-metadata'
import { HttpException, Logger } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ErrorCode } from '../../constants/error-codes'
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter'
import { translate, translateStored, zh, type LocalizedMessage } from '..'
import { AdminTaxonomyService } from '../../../modules/post/admin-taxonomy.service'
import { AdminPostService } from '../../../modules/post/admin-post.service'
import { PostBatchService } from '../../../modules/post/post-batch.service'
import { canonicalTaxonomyLabel } from '../../../modules/post/taxonomy-aliases'
import type { PostRevisionsService } from '../../../modules/post/post-revisions.service'
import { AdminCommentService } from '../../../modules/comment/admin-comment.service'
import type { CommentService } from '../../../modules/comment/comment.service'
import type { CommentModerationService } from '../../../modules/comment/comment-moderation.service'
import { AdminFlashService } from '../../../modules/flash/admin-flash.service'
import type { FlashService } from '../../../modules/flash/flash.service'

async function rejected(run: () => unknown): Promise<HttpException> {
  try {
    await run()
  } catch (error) {
    return error as HttpException
  }
  throw new Error('预期抛出异常')
}

function render(exception: unknown, headers: Record<string, string> = {}) {
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
  const request = { method: 'PUT', path: '/api/v1/admin/posts/7', headers }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost
  new AllExceptionsFilter().catch(exception, host)
  return sent
}

const english = (error: HttpException) => {
  const body = error.getResponse() as LocalizedMessage
  return translate('en', body.messageKey, body.messageParams)
}

const revisions = {} as PostRevisionsService

describe('文章、评论与闪念的英文异常', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('标签仍被引用：带参数并登记资源占用业务码', async () => {
    const em = {
      transactional: (run: (inner: unknown) => unknown) => run(em),
      execute: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 3, label: '前端' }),
      count: jest.fn().mockResolvedValue(4),
    }
    const service = new AdminTaxonomyService(em as unknown as EntityManager, revisions)
    const error = await rejected(() => service.remove('tags', 3))
    expect(error.message).toBe('标签仍被 4 篇文章引用（含草稿和归档），请先移除文章标签')
    expect(english(error)).toBe(
      'This tag is still used by 4 posts (including drafts and archives). Remove it from those posts first.',
    )
    const zhBody = render(error).body
    expect(zhBody).toMatchObject({ code: ErrorCode.ResourceInUse, message: error.message })
    expect(render(error, { 'accept-language': 'en' }).body).toMatchObject({
      code: ErrorCode.ResourceInUse,
      message: english(error),
    })
  })

  it('保存缺少内容版本：428 登记版本冲突业务码', async () => {
    const service = new AdminPostService({} as EntityManager, revisions)
    const error = await rejected(() =>
      (service as unknown as { assertRevision(post: unknown, expected?: number): void }).assertRevision(
        { revision: 2 },
        undefined,
      ),
    )
    expect(error.getStatus()).toBe(428)
    expect(error.message).toBe('保存需要内容版本，请重新读取文章后合并修改')
    const sent = render(error, { 'accept-language': 'en-US,en;q=0.9' })
    expect(sent.status).toBe(428)
    expect(sent.body).toMatchObject({
      code: ErrorCode.RevisionConflict,
      message: 'Saving requires a content revision. Reload the post and merge your changes.',
    })
  })

  it('历史目录名指向已删除目标：英文可读，默认中文不变', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({ target: '旧专栏' }),
      count: jest.fn().mockResolvedValue(0),
    }
    const error = await rejected(() => canonicalTaxonomyLabel(em as unknown as EntityManager, 'folders', '旧名'))
    expect(error.message).toBe('旧目录名称的目标已删除，请重新选择专栏或标签')
    expect(render(error).body).toMatchObject({ message: '旧目录名称的目标已删除，请重新选择专栏或标签' })
    expect(english(error)).toBe('The target of this former name has been deleted. Choose a folder or tag again.')
  })

  it('评论日期范围与闪念内容校验：英文可读，默认中文不变', async () => {
    const comments = new AdminCommentService({} as EntityManager, {} as CommentService, {} as CommentModerationService)
    const range = await rejected(() => comments.list({ page: 1, pageSize: 20, from: '2026-10-19', to: '2026-10-01' }))
    expect(range.message).toBe('开始日期不能晚于结束日期')
    expect(render(range, { 'accept-language': 'en' }).body).toMatchObject({
      code: ErrorCode.ParamInvalid,
      message: 'The start date cannot be later than the end date',
    })

    const flashes = new AdminFlashService({} as EntityManager, {} as FlashService)
    const empty = await rejected(() => flashes.save(null, { content: '' } as Parameters<AdminFlashService['save']>[1]))
    expect(empty.message).toBe('闪念内容不能为空')
    expect(english(empty)).toBe('The flash note content cannot be empty')
  })

  it('永久删除确认文字仍校验中文原文，提示迁入字典', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValue({
        id: 'ticket',
        action: 'delete',
        plan: [],
        results: [],
        sessionVersion: 1,
        expiresAt: new Date(Date.now() + 60000),
      }),
    }
    const service = new PostBatchService(em as unknown as EntityManager, revisions)
    const admin = { id: 'admin', sessionVersion: 1, sessionId: 'session' }
    const error = await rejected(() => service.execute('ticket', 'delete permanently', admin, 'en'))
    expect(error.message).toBe('永久删除需要输入确认文字')
    expect(english(error)).toBe('Enter the confirmation text to permanently delete')
  })

  it('批量计划原因与执行结果以中文持久化，读取时按语言翻译', async () => {
    const plan = [
      {
        id: 1,
        title: zh('post.batchMissingTitle'),
        revision: 1,
        status: '',
        deleted: false,
        allowed: false,
        reason: zh('post.notFound'),
        impact: { comments: 0, commentLikes: 0, revisions: 0, addresses: 0, mediaReferences: 0, likes: 0, views: 0 },
        fingerprint: '',
      },
      {
        id: 2,
        title: '已完成',
        revision: 3,
        status: 'published',
        deleted: false,
        allowed: true,
        reason: '',
        impact: { comments: 0, commentLikes: 0, revisions: 0, addresses: 0, mediaReferences: 0, likes: 0, views: 0 },
        fingerprint: 'f',
      },
    ]
    const results = [
      { id: 1, success: false, message: '文章不存在' },
      { id: 2, success: false, message: '预览后内容或影响范围发生变化，请重新预览' },
      { id: 3, success: false, message: '博主手写的说明' },
    ]
    const operation = {
      id: 'ticket',
      action: 'archive',
      plan,
      results,
      expiresAt: new Date(Date.now() + 60000),
      finishedAt: new Date(),
    }
    const em = { findOne: jest.fn().mockResolvedValue(operation) }
    const service = new PostBatchService(em as unknown as EntityManager, revisions)
    const admin = { id: 'admin', sessionVersion: 1, sessionId: 'session' }

    const chinese = await service.get('ticket', admin)
    expect(chinese.results.map((item) => item.message)).toEqual([
      '文章不存在',
      '预览后内容或影响范围发生变化，请重新预览',
      '博主手写的说明',
    ])
    expect(chinese.preview.items[0]).toMatchObject({ title: '已不存在的文章', reason: '文章不存在' })

    const en = await service.get('ticket', admin, 'en')
    expect(en.results.map((item) => item.message)).toEqual([
      'Post not found',
      'The content or affected scope changed after the preview. Preview again.',
      '博主手写的说明',
    ])
    expect(en.preview.items[0]).toMatchObject({ title: 'Deleted post', reason: 'Post not found' })
    // 真实文章标题即使与字典文案相同也不翻译
    expect(en.preview.items[1]).toMatchObject({ title: '已完成', reason: '' })
    // 持久化内容本身保持中文
    expect(operation.results[0]!.message).toBe('文章不存在')
    expect(translateStored('en', '评论状态已改变，请重新加载后再操作')).toBe(
      'The comment status has changed. Reload and try again.',
    )
  })
})
