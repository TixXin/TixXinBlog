/** @file operations.dto.spec.ts @description 运行任务重试 DTO 的状态、次数和确认文本边界，不执行真实重试。 */
import type { ClassConstructor } from 'class-transformer'
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { OperationsController } from './operations.controller'

// 使用 controller 实际注册的未导出请求类型，只运行 class-validator。
const parameterTypes = Reflect.getMetadata(
  'design:paramtypes',
  OperationsController.prototype,
  'retry',
) as ClassConstructor<object>[]
const RetryTaskDto = parameterTypes[1]!
const retry = { expectedState: 'failed', expectedAttempts: 0, acknowledgement: '重试失败任务' }

describe('运行任务重试 DTO', () => {
  it('校验真实路由请求类型并接受各个可重试状态与确认文字', () => {
    expect(RetryTaskDto.name).toBe('RetryTaskDto')
    for (const [expectedState, acknowledgement] of [
      ['failed', '重试失败任务'],
      ['uncertain', '已核对未送达并承担重复投递风险'],
      ['restored', '明确重新投递恢复前任务'],
    ])
      expectDtoValid(RetryTaskDto, { ...retry, expectedState, acknowledgement })
  })

  it('状态与确认文本只允许已声明枚举，不能缺失或使用其他类型', () => {
    for (const expectedState of [undefined, 'queued', '', 1, null, []])
      expectDtoInvalid(RetryTaskDto, { ...retry, expectedState }, 'expectedState', 'isIn')
    for (const acknowledgement of [undefined, '', '重试失败任务 ', '确认', 1, null, []])
      expectDtoInvalid(RetryTaskDto, { ...retry, acknowledgement }, 'acknowledgement', 'isIn')
  })

  it('重试次数要求非负整数，不隐式转换字符串', () => {
    for (const expectedAttempts of [0, 1]) expectDtoValid(RetryTaskDto, { ...retry, expectedAttempts })
    expectDtoInvalid(RetryTaskDto, { ...retry, expectedAttempts: -1 }, 'expectedAttempts', 'min')
    for (const expectedAttempts of [undefined, 0.5, '0', true, null, []])
      expectDtoInvalid(RetryTaskDto, { ...retry, expectedAttempts }, 'expectedAttempts', 'isInt')
  })

  it('拒绝绕过运行状态的多余字段', () => {
    expectDtoInvalid(RetryTaskDto, { ...retry, force: true }, 'force', 'whitelistValidation')
  })
})
