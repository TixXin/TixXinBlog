/** @file backup.dto.spec.ts @description 内容包写入参数的直接 DTO 校验，不实例化控制器或接触数据库、媒体。 */
import type { ClassConstructor } from 'class-transformer'
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { BackupController } from './backup.controller'

// 通过真实路由参数元数据取得未导出的 DTO，避免为了测试扩大生产模块的导出面。
function bodyDto(method: string, index: number): ClassConstructor<object> {
  const types = Reflect.getMetadata(
    'design:paramtypes',
    BackupController.prototype,
    method,
  ) as ClassConstructor<object>[]
  return types[index]!
}

const ExportContentDto = bodyDto('export', 0)
const PreviewContentDto = bodyDto('preview', 1)
const ExecuteContentDto = bodyDto('execute', 1)
const requestId = '12345678-1234-4234-8234-123456789abc'
const confirmation = 'a'.repeat(64)
const execution = { acknowledgement: '导入为新草稿', confirmation }

describe('内容包 DTO', () => {
  it('取得实际路由的三个请求类型', () => {
    expect([ExportContentDto.name, PreviewContentDto.name, ExecuteContentDto.name]).toEqual([
      'ExportContentDto',
      'PreviewContentDto',
      'ExecuteContentDto',
    ])
  })

  it('导出允许省略媒体选项，仅接受布尔值并拒绝多余字段', () => {
    expectDtoValid(ExportContentDto, {})
    for (const mediaIncluded of [true, false]) expectDtoValid(ExportContentDto, { mediaIncluded })
    for (const mediaIncluded of ['true', 1, null, [], {}])
      expectDtoInvalid(ExportContentDto, { mediaIncluded }, 'mediaIncluded', 'isBoolean')
    expectDtoInvalid(ExportContentDto, { path: '/tmp/export' }, 'path', 'whitelistValidation')
  })

  it('预览要求 UUID v4，只接受 skip/copy 和明确布尔选项', () => {
    expectDtoValid(PreviewContentDto, { requestId })
    for (const strategy of ['skip', 'copy']) {
      for (const includeSettings of [true, false, 'true', 'false'])
        expectDtoValid(PreviewContentDto, { requestId, strategy, includeSettings })
    }
    for (const value of [undefined, '', 1, '12345678-1234-1234-8234-123456789abc'])
      expectDtoInvalid(PreviewContentDto, { requestId: value }, 'requestId', 'isUuid')
    for (const strategy of ['replace', '', 1, [], null])
      expectDtoInvalid(PreviewContentDto, { requestId, strategy }, 'strategy', 'isIn')
    for (const includeSettings of ['TRUE', '1', '', 1, null, []])
      expectDtoInvalid(PreviewContentDto, { requestId, includeSettings }, 'includeSettings', 'isBoolean')
    expectDtoInvalid(PreviewContentDto, { requestId, overwrite: true }, 'overwrite', 'whitelistValidation')
  })

  it('执行要求精确确认文字与 64 位小写十六进制摘要', () => {
    expectDtoValid(ExecuteContentDto, execution)
    expectDtoValid(ExecuteContentDto, { ...execution, confirmation: '0123456789abcdef'.repeat(4) })
    for (const acknowledgement of ['', '导入', '导入为新草稿 ', null, 1])
      expectDtoInvalid(ExecuteContentDto, { ...execution, acknowledgement }, 'acknowledgement', 'isIn')
    for (const value of [undefined, 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), 1, null])
      expectDtoInvalid(ExecuteContentDto, { ...execution, confirmation: value }, 'confirmation', 'matches')
    expectDtoInvalid(ExecuteContentDto, { ...execution, force: true }, 'force', 'whitelistValidation')
  })
})
