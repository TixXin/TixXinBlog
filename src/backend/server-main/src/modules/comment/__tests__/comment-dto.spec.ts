/** @file comment-dto.spec.ts @description 公开评论及后台回复、审核、策略与批量操作的 DTO 边界。 */
import { plainToInstance } from 'class-transformer'
import { expectDtoInvalid, expectDtoValid } from '../../../common/testing/dto-validation'
import { COMMENT_STATUSES } from '../../../entities/comment.entity'
import {
  AdminReplyDto,
  BatchCommentDeleteDto,
  BatchCommentModerationDto,
  CommentSelectionDto,
  DeleteAdminCommentDto,
  ModerateCommentDto,
  SaveCommentPolicyDto,
} from '../admin-comment.controller'
import { CreateCommentDto } from '../dto/create-comment.dto'

const requestId = '12345678-1234-4123-8123-123456789abc'
const fingerprint = 'a'.repeat(64)
const selections = (length: number) => Array.from({ length }, (_, index) => ({ id: index + 1, revision: 0 }))

describe('公开评论 DTO', () => {
  const valid = { author: '访客', content: '读后感' }

  it.each([
    ['author', 32],
    ['content', 1000],
  ] as const)('%s 在裁剪后检查最小值和上限', (field, max) => {
    expectDtoValid(CreateCommentDto, { ...valid, [field]: ' 字 ' })
    expectDtoValid(CreateCommentDto, { ...valid, [field]: ` ${'字'.repeat(max)} ` })
    expectDtoInvalid(CreateCommentDto, { ...valid, [field]: ' \n\t ' }, field, 'minLength')
    expectDtoInvalid(CreateCommentDto, { ...valid, [field]: '字'.repeat(max + 1) }, field, 'maxLength')
    for (const value of [undefined, null, 1, false, [], {}]) {
      expectDtoInvalid(CreateCommentDto, { ...valid, [field]: value }, field, 'isString')
    }
  })

  it('可省略提交标识和头像，但提供时检查 UUID v4、类型与头像长度', () => {
    expectDtoValid(CreateCommentDto, { ...valid, requestId, avatar: '' })
    expectDtoValid(CreateCommentDto, { ...valid, avatar: 'a'.repeat(512) })
    expectDtoInvalid(CreateCommentDto, { ...valid, avatar: 'a'.repeat(513) }, 'avatar', 'maxLength')
    // null 头像由服务层回退默认头像，DTO 与省略同样放行
    expectDtoValid(CreateCommentDto, { ...valid, avatar: null })
    for (const value of [123, false, {}, []]) {
      expectDtoInvalid(CreateCommentDto, { ...valid, avatar: value }, 'avatar', 'isString')
    }
    for (const value of ['', '12345678-1234-1123-8123-123456789abc', 123]) {
      expectDtoInvalid(CreateCommentDto, { ...valid, requestId: value }, 'requestId', 'isUuid')
    }
  })

  it('父评论编号允许数字字符串转换，拒绝非正数、非整数和非数字', () => {
    expectDtoValid(CreateCommentDto, { ...valid, parentId: '1' })
    expect(plainToInstance(CreateCommentDto, { ...valid, parentId: '1' }).parentId).toBe(1)
    for (const value of [0, -1]) {
      expectDtoInvalid(CreateCommentDto, { ...valid, parentId: value }, 'parentId', 'min')
    }
    for (const value of [1.5, '', ' \t ', true, false, 'abc', {}, []]) {
      expectDtoInvalid(CreateCommentDto, { ...valid, parentId: value }, 'parentId', 'isInt')
    }
  })

  it.each(['isOwner', 'status', 'revision', 'visitorIdHash'])('拒绝客户端系统字段 %s', (field) => {
    expectDtoInvalid(CreateCommentDto, { ...valid, [field]: true }, field, 'whitelistValidation')
  })
})

describe('后台评论写入 DTO', () => {
  it('博主回复要求 1–1000 字符并拒绝身份和错误类型', () => {
    expectDtoValid(AdminReplyDto, { content: '字' })
    expectDtoValid(AdminReplyDto, { content: '字'.repeat(1000) })
    expectDtoInvalid(AdminReplyDto, { content: '' }, 'content', 'minLength')
    expectDtoInvalid(AdminReplyDto, { content: '字'.repeat(1001) }, 'content', 'maxLength')
    for (const content of [undefined, null, 1, false, [], {}]) {
      expectDtoInvalid(AdminReplyDto, { content }, 'content', 'isString')
    }
    expectDtoInvalid(AdminReplyDto, { content: '回复', author: '冒名' }, 'author', 'whitelistValidation')
  })

  it.each(COMMENT_STATUSES)('审核接受状态 %s 和版本零', (status) => {
    expectDtoValid(ModerateCommentDto, { status, revision: 0, expectedFingerprint: fingerprint })
  })

  it('审核拒绝非法状态、版本和额外字段', () => {
    const valid = { status: 'published', revision: 0, expectedFingerprint: fingerprint }
    for (const status of ['deleted', 'PUBLISHED', '', null, 1, false]) {
      expectDtoInvalid(ModerateCommentDto, { ...valid, status }, 'status', 'isIn')
    }
    expectDtoInvalid(ModerateCommentDto, { ...valid, revision: -1 }, 'revision', 'min')
    for (const revision of [undefined, null, '0', 0.5, false, {}]) {
      expectDtoInvalid(ModerateCommentDto, { ...valid, revision }, 'revision', 'isInt')
    }
    expectDtoInvalid(ModerateCommentDto, { ...valid, id: 2 }, 'id', 'whitelistValidation')
  })

  it.each([DeleteAdminCommentDto, ModerateCommentDto].map((Dto) => ({ name: Dto.name, Dto })))(
    '$name 必须携带完整小写 SHA-256 指纹',
    ({ Dto }) => {
      const valid = {
        expectedFingerprint: fingerprint,
        ...(Dto === ModerateCommentDto ? { status: 'pending', revision: 0 } : {}),
      }
      expectDtoValid(Dto, valid)
      for (const expectedFingerprint of [
        '',
        'a'.repeat(63),
        'a'.repeat(65),
        'A'.repeat(64),
        'g'.repeat(64),
        undefined,
        null,
        1,
      ]) {
        expectDtoInvalid(Dto, { ...valid, expectedFingerprint }, 'expectedFingerprint', 'matches')
      }
    },
  )

  it('删除预期数量可省略或转换，拒绝零、非整数和多余字段', () => {
    const valid = { expectedFingerprint: fingerprint }
    expectDtoValid(DeleteAdminCommentDto, { ...valid, expectedTotal: '1' })
    expectDtoInvalid(DeleteAdminCommentDto, { ...valid, expectedTotal: 0 }, 'expectedTotal', 'min')
    for (const expectedTotal of [1.5, '', ' \t ', true, false, 'invalid', {}, []]) {
      expectDtoInvalid(DeleteAdminCommentDto, { ...valid, expectedTotal }, 'expectedTotal', 'isInt')
    }
    expectDtoInvalid(DeleteAdminCommentDto, { ...valid, force: true }, 'force', 'whitelistValidation')
  })

  it('审核策略只接受真实布尔值与非负整数版本', () => {
    for (const requireApproval of [true, false]) {
      expectDtoValid(SaveCommentPolicyDto, { requireApproval, revision: 0 })
    }
    for (const requireApproval of [undefined, null, 'true', 'false', 0, 1, {}]) {
      expectDtoInvalid(SaveCommentPolicyDto, { requireApproval, revision: 0 }, 'requireApproval', 'isBoolean')
    }
    expectDtoInvalid(SaveCommentPolicyDto, { requireApproval: true, revision: -1 }, 'revision', 'min')
    for (const revision of [undefined, null, '0', false, 0.5]) {
      expectDtoInvalid(SaveCommentPolicyDto, { requireApproval: true, revision }, 'revision', 'isInt')
    }
    expectDtoInvalid(
      SaveCommentPolicyDto,
      { requireApproval: true, revision: 0, autoPublish: true },
      'autoPublish',
      'whitelistValidation',
    )
  })
})

describe('评论批量选择 DTO', () => {
  it('选择项拒绝错误编号、版本及额外字段', () => {
    expectDtoValid(CommentSelectionDto, { id: 1, revision: 0 })
    expectDtoInvalid(CommentSelectionDto, { id: 0, revision: 0 }, 'id', 'min')
    expectDtoInvalid(CommentSelectionDto, { id: 1, revision: -1 }, 'revision', 'min')
    for (const field of ['id', 'revision']) {
      for (const value of [undefined, null, '1', false, 1.5, {}]) {
        expectDtoInvalid(CommentSelectionDto, { id: 1, revision: 0, [field]: value }, field, 'isInt')
      }
    }
    expectDtoInvalid(CommentSelectionDto, { id: 1, revision: 0, status: 'published' }, 'status', 'whitelistValidation')
  })

  describe.each([BatchCommentDeleteDto, BatchCommentModerationDto].map((Dto) => ({ name: Dto.name, Dto })))(
    '$name',
    ({ Dto }) => {
      const base = Dto === BatchCommentModerationDto ? { status: 'published' } : {}

      it('接受 1/100 项，拒绝空、101 项、重复编号和非数组', () => {
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

      it('严格校验嵌套选择项，并拒绝顶层与嵌套越权字段', () => {
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

  it('批量审核逐一接受正式状态并拒绝非法枚举', () => {
    for (const status of COMMENT_STATUSES) expectDtoValid(BatchCommentModerationDto, { items: selections(1), status })
    for (const status of [undefined, null, 'deleted', '', 0, true]) {
      expectDtoInvalid(BatchCommentModerationDto, { items: selections(1), status }, 'status', 'isIn')
    }
  })
})
