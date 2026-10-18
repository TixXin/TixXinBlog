/** @file guestbook-dto.spec.ts @description 公开及后台留言、回应、版本和批量请求 DTO 的边界回归。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import { GUESTBOOK_REACTIONS } from '../../entities/guestbook-reaction.entity'
import {
  BatchGuestbookDeleteDto,
  BatchGuestbookModerationDto,
  GuestbookSelectionDto,
} from './admin-guestbook.controller'
import {
  CreateGuestbookDto,
  DeleteGuestbookDto,
  GuestbookBodyDto,
  SetGuestbookReactionDto,
  UpdateGuestbookDto,
} from './guestbook.dto'

const requestId = '12345678-1234-4123-8123-123456789abc'
const selections = (length: number) => Array.from({ length }, (_, index) => ({ id: index + 1, revision: 0 }))

describe.each([GuestbookBodyDto, CreateGuestbookDto].map((Dto) => ({ name: Dto.name, Dto })))(
  '留言正文 $name',
  ({ Dto }) => {
    const valid = { requestId, content: '留言', ...(Dto === CreateGuestbookDto ? { author: '访客' } : {}) }

    it('必填正文裁剪后为 1–500 字符，拒绝错误类型', () => {
      expectDtoValid(Dto, { ...valid, content: ' 字 ' })
      expectDtoValid(Dto, { ...valid, content: ` ${'字'.repeat(500)} ` })
      expectDtoInvalid(Dto, { ...valid, content: ' \n\t ' }, 'content', 'minLength')
      expectDtoInvalid(Dto, { ...valid, content: '字'.repeat(501) }, 'content', 'maxLength')
      for (const content of [undefined, null, 1, false, {}, []])
        expectDtoInvalid(Dto, { ...valid, content }, 'content', 'isString')
    })

    it('提交标识必须为 UUID v4', () => {
      expectDtoValid(Dto, valid)
      for (const value of [undefined, null, '', 1, '12345678-1234-1123-8123-123456789abc']) {
        expectDtoInvalid(Dto, { ...valid, requestId: value }, 'requestId', 'isUuid')
      }
    })

    it('回复编号可省略或清空，提供时在数据库整数范围内且不隐式转换', () => {
      for (const replyToId of [null, 1, 2147483647]) expectDtoValid(Dto, { ...valid, replyToId })
      expectDtoInvalid(Dto, { ...valid, replyToId: 0 }, 'replyToId', 'min')
      expectDtoInvalid(Dto, { ...valid, replyToId: 2147483648 }, 'replyToId', 'max')
      for (const replyToId of ['1', false, 1.5, {}, []])
        expectDtoInvalid(Dto, { ...valid, replyToId }, 'replyToId', 'isInt')
    })

    it.each(['isOwner', 'status', 'browser', 'region', 'createdAt'])('拒绝服务端负责的 %s 字段', (field) => {
      expectDtoInvalid(Dto, { ...valid, [field]: '注入' }, field, 'whitelistValidation')
    })
  },
)

describe('公开留言作者 DTO', () => {
  const valid = { requestId, content: '留言', author: '访客' }

  it('作者裁剪后为 1–32 字符且不可缺省', () => {
    expectDtoValid(CreateGuestbookDto, { ...valid, author: ' 字 ' })
    expectDtoValid(CreateGuestbookDto, { ...valid, author: ` ${'字'.repeat(32)} ` })
    expectDtoInvalid(CreateGuestbookDto, { ...valid, author: ' \n\t ' }, 'author', 'minLength')
    expectDtoInvalid(CreateGuestbookDto, { ...valid, author: '字'.repeat(33) }, 'author', 'maxLength')
    for (const author of [undefined, null, 1, false, {}, []])
      expectDtoInvalid(CreateGuestbookDto, { ...valid, author }, 'author', 'isString')
  })

  it('头像可省略、为空或到 2048 字符，超过或错误类型则拒绝', () => {
    expectDtoValid(CreateGuestbookDto, { ...valid, avatar: '' })
    expectDtoValid(CreateGuestbookDto, { ...valid, avatar: 'a'.repeat(2048) })
    expectDtoInvalid(CreateGuestbookDto, { ...valid, avatar: 'a'.repeat(2049) }, 'avatar', 'maxLength')
    for (const avatar of [1, false, {}, []])
      expectDtoInvalid(CreateGuestbookDto, { ...valid, avatar }, 'avatar', 'isString')
    expectDtoInvalid(
      GuestbookBodyDto,
      { requestId, content: '博主回复', author: '冒名' },
      'author',
      'whitelistValidation',
    )
  })
})

describe('留言管理和回应 DTO', () => {
  it('更新必须带数字版本，状态和置顶可省略但不可为 null', () => {
    expectDtoValid(UpdateGuestbookDto, { revision: 0 })
    for (const status of GUESTBOOK_STATUSES) expectDtoValid(UpdateGuestbookDto, { revision: 0, status })
    for (const isPinned of [true, false]) expectDtoValid(UpdateGuestbookDto, { revision: 0, isPinned })
    expectDtoInvalid(UpdateGuestbookDto, { revision: -1 }, 'revision', 'min')
    for (const revision of [undefined, null, '0', false, 0.5, {}])
      expectDtoInvalid(UpdateGuestbookDto, { revision }, 'revision', 'isInt')
    for (const status of [null, 'draft', 'PUBLISHED', '', 1, false])
      expectDtoInvalid(UpdateGuestbookDto, { revision: 0, status }, 'status', 'isIn')
    for (const isPinned of [null, 'true', 'false', 1, 0, {}])
      expectDtoInvalid(UpdateGuestbookDto, { revision: 0, isPinned }, 'isPinned', 'isBoolean')
    expectDtoInvalid(UpdateGuestbookDto, { revision: 0, content: '覆盖正文' }, 'content', 'whitelistValidation')
  })

  it('删除查询版本接受数字字符串，拒绝负数、非整数和多余字段', () => {
    expectDtoValid(DeleteGuestbookDto, { revision: 0 })
    expectDtoValid(DeleteGuestbookDto, { revision: '0' })
    expectDtoInvalid(DeleteGuestbookDto, { revision: -1 }, 'revision', 'min')
    for (const revision of [undefined, null, 0.5, '', ' \t ', true, false, 'invalid', {}, []])
      expectDtoInvalid(DeleteGuestbookDto, { revision }, 'revision', 'isInt')
    expectDtoInvalid(DeleteGuestbookDto, { revision: 0, force: true }, 'force', 'whitelistValidation')
  })

  it('回应逐一接受允许的符号，只接受真实布尔目标状态', () => {
    for (const emoji of GUESTBOOK_REACTIONS) {
      for (const reacted of [true, false]) expectDtoValid(SetGuestbookReactionDto, { emoji, reacted })
    }
    const emoji = GUESTBOOK_REACTIONS[0]
    for (const value of [undefined, null, '', 'like', 'x', 1, false]) {
      expectDtoInvalid(SetGuestbookReactionDto, { emoji: value, reacted: true }, 'emoji', 'isIn')
    }
    for (const reacted of [undefined, null, 'true', 'false', 1, 0, {}, []]) {
      expectDtoInvalid(SetGuestbookReactionDto, { emoji, reacted }, 'reacted', 'isBoolean')
    }
    expectDtoInvalid(SetGuestbookReactionDto, { emoji, reacted: true, count: 10 }, 'count', 'whitelistValidation')
  })
})

describe('留言批量 DTO', () => {
  it('选择项编号和版本必须为规定下限内的整数', () => {
    expectDtoValid(GuestbookSelectionDto, { id: 1, revision: 0 })
    expectDtoInvalid(GuestbookSelectionDto, { id: 0, revision: 0 }, 'id', 'min')
    expectDtoInvalid(GuestbookSelectionDto, { id: 1, revision: -1 }, 'revision', 'min')
    for (const field of ['id', 'revision']) {
      for (const value of [undefined, null, '1', false, 1.5, {}]) {
        expectDtoInvalid(GuestbookSelectionDto, { id: 1, revision: 0, [field]: value }, field, 'isInt')
      }
    }
    expectDtoInvalid(
      GuestbookSelectionDto,
      { id: 1, revision: 0, status: 'published' },
      'status',
      'whitelistValidation',
    )
  })

  describe.each([BatchGuestbookDeleteDto, BatchGuestbookModerationDto].map((Dto) => ({ name: Dto.name, Dto })))(
    '$name',
    ({ Dto }) => {
      const base = Dto === BatchGuestbookModerationDto ? { status: 'published' } : {}

      it('接受 1/100 项，拒绝空、超限、重复编号和非数组', () => {
        for (const count of [1, 100]) expectDtoValid(Dto, { ...base, items: selections(count) })
        expectDtoInvalid(Dto, { ...base, items: [] }, 'items', 'arrayMinSize')
        expectDtoInvalid(Dto, { ...base, items: selections(101) }, 'items', 'arrayMaxSize')
        expectDtoInvalid(
          Dto,
          {
            ...base,
            items: [
              { id: 1, revision: 0 },
              { id: 1, revision: 1 },
            ],
          },
          'items',
          'arrayUnique',
        )
        for (const items of [undefined, null, {}, '1']) expectDtoInvalid(Dto, { ...base, items }, 'items', 'isArray')
      })

      it('严格校验嵌套项，拒绝数组冒充选择对象及越权字段', () => {
        expectDtoInvalid(Dto, { ...base, items: [{ id: 0, revision: 0 }] }, 'items.0.id', 'min')
        expectDtoInvalid(Dto, { ...base, items: [{ id: 1, revision: '0' }] }, 'items.0.revision', 'isInt')
        expectDtoInvalid(Dto, { ...base, items: [null] }, 'items.0', 'nestedValidation')
        expectDtoInvalid(Dto, { ...base, items: [[]] }, 'items', 'isObject')
        expectDtoInvalid(
          Dto,
          { ...base, items: [{ id: 1, revision: 0, force: true }] },
          'items.0.force',
          'whitelistValidation',
        )
        expectDtoInvalid(Dto, { ...base, items: selections(1), force: true }, 'force', 'whitelistValidation')
      })
    },
  )

  it('批量审核状态必填且限制正式枚举', () => {
    for (const status of GUESTBOOK_STATUSES)
      expectDtoValid(BatchGuestbookModerationDto, { items: selections(1), status })
    for (const status of [undefined, null, 'spam', '', 1, false]) {
      expectDtoInvalid(BatchGuestbookModerationDto, { items: selections(1), status }, 'status', 'isIn')
    }
  })
})
