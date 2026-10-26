/** @file link-application.dto.spec.ts @description 友链申请公开提交与审核筛选的 DTO 边界回归 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { AdminLinkApplicationQuery, CreateLinkApplicationDto } from './link-application.dto'
import { SaveLinkSettingsDto } from './link.dto'

const valid = { name: '松下问童子', url: 'https://pine.example.org/' }

describe('友链申请提交 DTO', () => {
  it('名称与地址必填，其余字段选填，联系方式可为空值', () => {
    expectDtoValid(CreateLinkApplicationDto, valid)
    expectDtoValid(CreateLinkApplicationDto, { ...valid, description: '', contact: null, message: '' })
    expectDtoInvalid(CreateLinkApplicationDto, { url: valid.url }, 'name', 'isString')
    expectDtoInvalid(CreateLinkApplicationDto, { name: valid.name }, 'url', 'isString')
    expectDtoInvalid(CreateLinkApplicationDto, { ...valid, name: '' }, 'name', 'minLength')
  })

  it.each([
    ['name', 80],
    ['description', 300],
    ['contact', 200],
    ['message', 1000],
  ] as const)('%s 检查 UTF-16 上限', (field, max) => {
    expectDtoValid(CreateLinkApplicationDto, { ...valid, [field]: '字'.repeat(max) })
    expectDtoInvalid(CreateLinkApplicationDto, { ...valid, [field]: '字'.repeat(max + 1) }, field, 'maxUtf16Length')
  })

  it('地址不超过 2048 字符', () => {
    expectDtoInvalid(CreateLinkApplicationDto, { ...valid, url: 'a'.repeat(2049) }, 'url', 'maxLength')
  })

  it('蜜罐有值或填写时间过短时拒绝', () => {
    expectDtoValid(CreateLinkApplicationDto, { ...valid, website: '', formElapsedMs: 5000 })
    expectDtoInvalid(CreateLinkApplicationDto, { ...valid, website: 'x' }, 'website', 'visitorSubmissionField')
    expectDtoInvalid(
      CreateLinkApplicationDto,
      { ...valid, formElapsedMs: 10 },
      'formElapsedMs',
      'visitorSubmissionField',
    )
  })
})

describe('友链申请审核筛选与开关 DTO', () => {
  it('状态只接受待审、已通过、已拒绝、已处理与全部', () => {
    for (const status of ['pending', 'approved', 'rejected', 'handled', 'all'])
      expectDtoValid(AdminLinkApplicationQuery, { status })
    expectDtoInvalid(AdminLinkApplicationQuery, { status: 'draft' }, 'status', 'isIn')
  })

  it('规则设置的申请开关选填且只接受布尔值', () => {
    expectDtoValid(SaveLinkSettingsDto, { revision: 0, rules: [] })
    expectDtoValid(SaveLinkSettingsDto, { revision: 0, rules: [], applicationsEnabled: true })
    expectDtoInvalid(
      SaveLinkSettingsDto,
      { revision: 0, rules: [], applicationsEnabled: 'yes' },
      'applicationsEnabled',
      'isBoolean',
    )
  })
})
