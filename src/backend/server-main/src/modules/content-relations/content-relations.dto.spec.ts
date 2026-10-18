/** @file content-relations.dto.spec.ts @description 关联解析请求的数量、标识、枚举和嵌套白名单边界。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { CONTENT_RELATION_TYPES } from '../../common/types/content-relation'
import { ContentRelationDto, ResolveContentRelationsDto } from './content-relations.dto'

describe('内容关联 DTO', () => {
  it.each(CONTENT_RELATION_TYPES)('接受关联类型 %s 与编号上下限', (type) => {
    expectDtoValid(ContentRelationDto, { type, id: 1 })
    expectDtoValid(ContentRelationDto, { type, id: 2147483647 })
  })

  it.each([
    ['type', 'prompt', 'isIn'],
    ['type', 1, 'isIn'],
    ['type', null, 'isIn'],
    ['id', 0, 'min'],
    ['id', 2147483648, 'max'],
    ['id', 1.5, 'isInt'],
    ['id', '1', 'isInt'],
    ['id', null, 'isInt'],
  ] as const)('拒绝 %s 的非法值 %j', (field, value, constraint) => {
    expectDtoInvalid(ContentRelationDto, { type: 'post', id: 1, [field]: value }, field, constraint)
  })

  it('必填字段和服务端派生字段均受约束', () => {
    expectDtoInvalid(ContentRelationDto, {}, 'type', 'isIn')
    expectDtoInvalid(ContentRelationDto, {}, 'id', 'isInt')
    for (const field of ['title', 'status', 'unknown'])
      expectDtoInvalid(ContentRelationDto, { type: 'post', id: 1, [field]: 'published' }, field, 'whitelistValidation')
  })

  it('解析请求接受空列表和十二项，拒绝超过上限', () => {
    expectDtoValid(ResolveContentRelationsDto, { relatedContent: [] })
    expectDtoValid(ResolveContentRelationsDto, {
      relatedContent: Array.from({ length: 12 }, (_, i) => ({ type: 'post', id: i + 1 })),
    })
    expectDtoInvalid(
      ResolveContentRelationsDto,
      { relatedContent: Array(13).fill({ type: 'post', id: 1 }) },
      'relatedContent',
      'arrayMaxSize',
    )
  })

  it('解析请求逐层拒绝错误类型和未知字段', () => {
    expectDtoInvalid(ResolveContentRelationsDto, {}, 'relatedContent', 'isArray')
    expectDtoInvalid(ResolveContentRelationsDto, { relatedContent: {} }, 'relatedContent', 'isArray')
    expectDtoInvalid(ResolveContentRelationsDto, { relatedContent: [1] }, 'relatedContent.0', 'nestedValidation')
    expectDtoInvalid(ResolveContentRelationsDto, { relatedContent: [[]] }, 'relatedContent', 'isObject')
    expectDtoInvalid(
      ResolveContentRelationsDto,
      { relatedContent: [{ type: 'post', id: '1' }] },
      'relatedContent.0.id',
      'isInt',
    )
    expectDtoInvalid(
      ResolveContentRelationsDto,
      { relatedContent: [{ type: 'post', id: 1, title: '伪造标题' }] },
      'relatedContent.0.title',
      'whitelistValidation',
    )
    expectDtoInvalid(
      ResolveContentRelationsDto,
      { relatedContent: [], unknown: true },
      'unknown',
      'whitelistValidation',
    )
  })
})
