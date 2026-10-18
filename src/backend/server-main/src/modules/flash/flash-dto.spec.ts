/** @file flash-dto.spec.ts @description 公开闪念评论与后台闪念写入 DTO 的严格输入边界。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { FLASH_TYPES } from '../../entities/flash-note.entity'
import { SaveFlashDto } from './admin-flash.controller'
import { CreateFlashCommentDto } from './dto/create-flash-comment.dto'

describe('闪念评论 DTO', () => {
  const valid = { authorName: '访客', content: '回应' }

  it.each([
    ['authorName', 32],
    ['content', 500],
  ] as const)('%s 裁剪后接受边界长度，拒绝空白、超长及错误类型', (field, max) => {
    expectDtoValid(CreateFlashCommentDto, { ...valid, [field]: ' 字 ' })
    expectDtoValid(CreateFlashCommentDto, { ...valid, [field]: ` ${'字'.repeat(max)} ` })
    expectDtoInvalid(CreateFlashCommentDto, { ...valid, [field]: ' \n\t ' }, field, 'minLength')
    expectDtoInvalid(CreateFlashCommentDto, { ...valid, [field]: '字'.repeat(max + 1) }, field, 'maxLength')
    for (const value of [undefined, null, 1, false, [], {}]) {
      expectDtoInvalid(CreateFlashCommentDto, { ...valid, [field]: value }, field, 'isString')
    }
  })

  it('可选头像接受空串和长度上限，拒绝超长与错误类型', () => {
    expectDtoValid(CreateFlashCommentDto, valid)
    expectDtoValid(CreateFlashCommentDto, { ...valid, authorAvatar: '' })
    expectDtoValid(CreateFlashCommentDto, { ...valid, authorAvatar: 'a'.repeat(512) })
    expectDtoInvalid(CreateFlashCommentDto, { ...valid, authorAvatar: 'a'.repeat(513) }, 'authorAvatar', 'maxLength')
    for (const authorAvatar of [null, 123, false, [], {}]) {
      expectDtoInvalid(CreateFlashCommentDto, { ...valid, authorAvatar }, 'authorAvatar', 'isString')
    }
  })

  it.each(['authorId', 'isOwner', 'createdAt'])('拒绝客户端伪造 %s', (field) => {
    expectDtoInvalid(CreateFlashCommentDto, { ...valid, [field]: '注入' }, field, 'whitelistValidation')
  })
})

describe('后台闪念 DTO', () => {
  it.each([
    ['content', 'isString'],
    ['tags', 'isArray'],
    ['images', 'isArray'],
    ['type', 'isIn'],
    ['isPinned', 'isBoolean'],
    ['isArchived', 'isBoolean'],
    ['isDraft', 'isBoolean'],
  ] as const)('%s 可以省略但不能以 null 覆盖非空持久字段', (field, constraint) => {
    expectDtoValid(SaveFlashDto, { [field]: undefined })
    expectDtoInvalid(SaveFlashDto, { [field]: null }, field, constraint)
  })

  it('允许局部编辑，正文裁剪后必须为 1–50000 字符', () => {
    expectDtoValid(SaveFlashDto, {})
    expectDtoValid(SaveFlashDto, { content: ' 字 ' })
    expectDtoValid(SaveFlashDto, { content: ` ${'字'.repeat(50000)} ` })
    expectDtoInvalid(SaveFlashDto, { content: ' \n\t ' }, 'content', 'minLength')
    expectDtoInvalid(SaveFlashDto, { content: '字'.repeat(50001) }, 'content', 'maxLength')
    for (const content of [1, false, [], {}]) expectDtoInvalid(SaveFlashDto, { content }, 'content', 'isString')
  })

  it.each([
    ['tags', 20, 64],
    ['images', 9, 2048],
  ] as const)('%s 分别检查数组容量、元素长度和元素类型', (field, count, max) => {
    expectDtoValid(SaveFlashDto, { [field]: [] })
    expectDtoValid(SaveFlashDto, { [field]: Array.from({ length: count }, () => 'a'.repeat(max)) })
    expectDtoInvalid(SaveFlashDto, { [field]: Array.from({ length: count + 1 }, () => 'a') }, field, 'arrayMaxSize')
    expectDtoInvalid(SaveFlashDto, { [field]: ['a'.repeat(max + 1)] }, field, 'maxLength')
    for (const value of ['a', 1, {}]) expectDtoInvalid(SaveFlashDto, { [field]: value }, field, 'isArray')
    for (const value of [1, null, false, [], {}])
      expectDtoInvalid(SaveFlashDto, { [field]: [value] }, field, 'isString')
  })

  it.each(FLASH_TYPES)('接受闪念类型 %s', (type) => {
    expectDtoValid(SaveFlashDto, { type })
  })

  it('拒绝未知枚举、非布尔标记和系统字段', () => {
    for (const type of ['draft', 'IDEA', '', 1, false, {}]) expectDtoInvalid(SaveFlashDto, { type }, 'type', 'isIn')
    for (const field of ['isPinned', 'isArchived', 'isDraft']) {
      for (const value of [true, false]) expectDtoValid(SaveFlashDto, { [field]: value })
      for (const value of ['true', 'false', 0, 1, {}, []])
        expectDtoInvalid(SaveFlashDto, { [field]: value }, field, 'isBoolean')
    }
    for (const field of ['userId', 'likes', 'createdAt']) {
      expectDtoInvalid(SaveFlashDto, { [field]: 1 }, field, 'whitelistValidation')
    }
  })
})
