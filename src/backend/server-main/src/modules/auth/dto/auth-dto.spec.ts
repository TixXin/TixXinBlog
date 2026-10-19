/** @file auth-dto.spec.ts @description 登录与改密 DTO 的长度、类型和严格白名单边界。 */
import { plainToInstance } from 'class-transformer'
import { expectDtoInvalid, expectDtoValid } from '../../../common/testing/dto-validation'
import { ChangePasswordDto } from './change-password.dto'
import { LoginDto } from './login.dto'

describe('登录 DTO', () => {
  const valid = { username: '博主', password: '密码' }

  it.each([
    ['username', 64],
    ['password', 128],
  ] as const)('%s 接受首尾长度，拒绝空串、超长和非字符串', (field, max) => {
    expectDtoValid(LoginDto, { ...valid, [field]: '字' })
    expectDtoValid(LoginDto, { ...valid, [field]: '字'.repeat(max) })
    expectDtoInvalid(LoginDto, { ...valid, [field]: '' }, field, 'minLength')
    expectDtoInvalid(LoginDto, { ...valid, [field]: '字'.repeat(max + 1) }, field, 'maxLength')
    for (const value of [undefined, null, 123, false, [], {}]) {
      expectDtoInvalid(LoginDto, { ...valid, [field]: value }, field, 'isString')
    }
  })

  it('拒绝客户端注入管理身份，保留用户名和密码原始空白', () => {
    expectDtoInvalid(LoginDto, { ...valid, isAdmin: true }, 'isAdmin', 'whitelistValidation')
    expect(plainToInstance(LoginDto, { username: ' 博主 ', password: ' 密码 ' })).toEqual({
      username: ' 博主 ',
      password: ' 密码 ',
    })
  })
})

describe('改密 DTO', () => {
  const valid = { currentPassword: '原密码', newPassword: '新'.repeat(6) }

  it.each([
    ['currentPassword', 1],
    ['newPassword', 6],
  ] as const)('%s 校验独立的最小长度和 128 字符上限', (field, min) => {
    expectDtoValid(ChangePasswordDto, { ...valid, [field]: '字'.repeat(min) })
    expectDtoValid(ChangePasswordDto, { ...valid, [field]: '字'.repeat(128) })
    expectDtoInvalid(ChangePasswordDto, { ...valid, [field]: '字'.repeat(min - 1) }, field, 'minLength')
    expectDtoInvalid(ChangePasswordDto, { ...valid, [field]: '字'.repeat(129) }, field, 'maxLength')
    for (const value of [undefined, null, 123, false, [], {}]) {
      expectDtoInvalid(ChangePasswordDto, { ...valid, [field]: value }, field, 'isString')
    }
  })

  it('拒绝越权账号字段且不裁剪密码', () => {
    expectDtoInvalid(ChangePasswordDto, { ...valid, userId: '其他账号' }, 'userId', 'whitelistValidation')
    const passwords = { currentPassword: ' 原密码 ', newPassword: ' 新密码中的空格也应保留 ' }
    expectDtoValid(ChangePasswordDto, passwords)
    expect(plainToInstance(ChangePasswordDto, passwords)).toEqual(passwords)
  })
})
