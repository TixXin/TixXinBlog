/**
 * @file visitor-text-xss.spec.ts
 * @description 四类访客文本的存储安全契约：保留原文与 JSON 字符串，由前端实际渲染路径负责输出编码。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { Comment } from '../../../entities/comment.entity'
import { CommentPolicy } from '../../../entities/comment-policy.entity'
import { FlashComment } from '../../../entities/flash-comment.entity'
import { FlashNote } from '../../../entities/flash-note.entity'
import { GuestbookMessage } from '../../../entities/guestbook-message.entity'
import { Moment } from '../../../entities/moment.entity'
import { MomentComment } from '../../../entities/moment-comment.entity'
import { Post } from '../../../entities/post.entity'
import { FlashService } from '../../flash/flash.service'
import { CreateFlashCommentDto } from '../../flash/dto/create-flash-comment.dto'
import { CreateGuestbookDto } from '../../guestbook/guestbook.dto'
import { GuestbookReadService } from '../../guestbook/guestbook-read.service'
import { GuestbookWriteService } from '../../guestbook/guestbook-write.service'
import { CreateMomentCommentDto } from '../../moment/moment.dto'
import { MomentInteractionService } from '../../moment/moment-interaction.service'
import { MomentReadService } from '../../moment/moment-read.service'
import { CommentService } from '../comment.service'
import { CreateCommentDto } from '../dto/create-comment.dto'

interface TextCase {
  name: string
  input: string
}

// 前后端共用完整载荷，避免存储边界与渲染边界各自维护一份而遗漏同一攻击。
const corpus = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../../../tests/fixtures/visitor-text-xss.json'), 'utf8'),
) as { attacks: TextCase[]; normal: TextCase }
const cases = [...corpus.attacks, corpus.normal]
const visitor = 'visitor-xss-regression'
const requestId = '452fb8d3-1541-4db2-ae1e-e47c5142ca14'
const author = '访客<img src=x onerror=alert(1)>'
type EntityConstructor<T extends object = object> = new () => T

/** 只替换持久化适配器，不初始化 ORM、建立数据库连接或执行 SQL。 */
function setup() {
  const rows = new Map<EntityConstructor, object[]>()
  const seed = <T extends object>(entity: EntityConstructor<T>, values: Partial<T>) => {
    const row = Object.assign(new entity(), values)
    rows.set(entity, [row])
    return row
  }
  const post = seed(Post, { id: 1, status: 'published', commentCount: 0 })
  const moment = seed(Moment, { id: 'moment-1', status: 'published' })
  const flash = seed(FlashNote, { id: 'flash-1', userId: 'tixxin', content: '公开闪念' })
  seed(CommentPolicy, { id: 'default', requireApproval: false })

  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    nativeDelete: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(async (entity: EntityConstructor) => rows.get(entity)?.[0] ?? null),
    findOneOrFail: jest.fn(async (entity: EntityConstructor) => {
      const row = rows.get(entity)?.[0]
      if (!row) throw new Error('内存测试记录缺失')
      return row
    }),
    find: jest.fn(async (entity: EntityConstructor) => rows.get(entity) ?? []),
    findAndCount: jest.fn(async (entity: EntityConstructor) => [rows.get(entity) ?? [], rows.get(entity)?.length ?? 0]),
    count: jest.fn(async (entity: EntityConstructor) => rows.get(entity)?.length ?? 0),
    create: jest.fn((entity: EntityConstructor, data: Record<string, unknown>) => {
      const id = entity === Comment || entity === GuestbookMessage ? 10 : 'comment-1'
      const row = Object.assign(new entity(), { id }, data)
      rows.set(entity, [...(rows.get(entity) ?? []), row])
      return row
    }),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  em.transactional.mockImplementation((run: (manager: typeof em) => unknown) => run(em))
  const saved = <T extends object>(entity: EntityConstructor<T>): T => {
    const row = rows.get(entity)?.[0]
    if (!row) throw new Error('服务未创建预期的访客记录')
    return row as T
  }
  return { em, manager: em as unknown as EntityManager, post, moment, flash, saved }
}

function dto<T extends { content: string }>(
  type: EntityConstructor<T>,
  input: string,
  identity: { requestId: string; author: string } | { authorName: string } = { requestId, author },
) {
  const value = plainToInstance(type, { ...identity, content: ` \n${input}\n ` })
  expect(validateSync(value, { whitelist: true, forbidNonWhitelisted: true })).toEqual([])
  expect(value.content).toBe(input)
  return value
}

function expectStoredText(
  state: ReturnType<typeof setup>,
  entity: EntityConstructor<{ content: string }>,
  input: string,
  ...projections: { content: string }[]
) {
  // 原始 HTML/Markdown 留在文本字段是预期行为，不能预编码、解码实体或把输入提升为 HTML。
  expect(state.em.create).toHaveBeenCalledWith(entity, expect.objectContaining({ content: input }))
  expect(state.em.flush).toHaveBeenCalled()
  expect(state.saved(entity).content).toBe(input)
  for (const projection of projections) {
    expect(typeof projection.content).toBe('string')
    expect(projection.content).toBe(input)
    expect(JSON.parse(JSON.stringify(projection))).toEqual(expect.objectContaining({ content: input }))
  }
}

describe('访客文本 XSS 存储与公开投影回归', () => {
  it.each(cases)('文章评论保留字符串：$name', async ({ input }) => {
    const state = setup()
    const service = new CommentService(state.manager)
    const created = await service.create(state.post.id, dto(CreateCommentDto, input), visitor)
    const tree = await service.getTree(state.post.id)
    expect(tree.items).toHaveLength(1)
    expectStoredText(state, Comment, input, created, tree.items[0]!)
    expect(state.saved(Comment).authorSnapshot.name).toBe(author)
    expect(created.author).toBe(author)
    expect(tree.items[0]!.author).toBe(author)
  })

  it.each(cases)('留言保留字符串及回复引用：$name', async ({ input }) => {
    const state = setup()
    const read = new GuestbookReadService(state.manager)
    const service = new GuestbookWriteService(state.manager, read)
    const created = await service.create(dto(CreateGuestbookDto, input), visitor)
    const detail = await read.detail(created.id)
    expectStoredText(state, GuestbookMessage, input, created, detail)
    expect(state.saved(GuestbookMessage).author).toBe(author)
    expect(detail.author).toBe(author)
    // 引用原留言的另一条公开留言也经过真实 serialize，覆盖缩略展示的第二个文本出口。
    const reply = Object.assign(new GuestbookMessage(), {
      id: 11,
      content: '我也有同样感受',
      author: '另一位访客',
      avatar: '',
      replyTo: state.saved(GuestbookMessage),
    })
    const [replyView] = await read.serialize([reply])
    expect(replyView!.replyTo).toEqual({ id: created.id, author, content: input })
    expect(JSON.parse(JSON.stringify(replyView)).replyTo.content).toBe(input)
  })

  it.each(cases)('闪念评论保留字符串：$name', async ({ input }) => {
    const state = setup()
    const service = new FlashService(
      state.manager,
      new ConfigService({ JWT_ACCESS_SECRET: 'visitor-xss-regression-secret-with-more-than-32-characters' }),
    )
    const created = await service.addComment(
      state.flash.id,
      dto(CreateFlashCommentDto, input, { authorName: author }),
      visitor,
    )
    // 模拟 ORM 已加载的关联集合，读取投影本身仍使用真实 serialize。
    jest.spyOn(state.flash.comments, 'getItems').mockReturnValue([state.saved(FlashComment)])
    const [note] = await service.serialize([state.flash], '')
    expect(note!.comments).toHaveLength(1)
    expectStoredText(state, FlashComment, input, created, note!.comments[0]!)
    expect(state.saved(FlashComment).authorName).toBe(author)
    expect(created.authorName).toBe(author)
    expect(note!.comments[0]!.authorName).toBe(author)
  })

  it.each(cases)('朋友圈评论保留字符串：$name', async ({ input }) => {
    const state = setup()
    const service = new MomentInteractionService(state.manager)
    const read = new MomentReadService(state.manager)
    const created = await service.comment(state.moment.id, dto(CreateMomentCommentDto, input), visitor)
    const comments = await read.comments(state.moment.id, { page: 1, pageSize: 15 })
    expect(comments.items).toHaveLength(1)
    expectStoredText(state, MomentComment, input, created, comments.items[0]!)
    expect(state.saved(MomentComment).author).toBe(author)
    expect(created.author).toBe(author)
    expect(comments.items[0]!.author).toBe(author)
  })
})
