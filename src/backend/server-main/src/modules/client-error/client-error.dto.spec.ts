/** @file client-error.dto.spec.ts @description 客户端错误 DTO 的类型、长度、协议与白名单校验。 */
import { ValidationPipe } from '@nestjs/common'
import { ClientErrorDto } from './client-error.dto'

const valid = { source: 'window', message: '页面脚本加载失败', url: 'https://blog.example.com/posts' }
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: ClientErrorDto })

describe('ClientErrorDto', () => {
  it.each(['vue', 'window', 'unhandledrejection'])('接受合法来源 %s 和省略可选字段', async (source) => {
    await expect(validate({ ...valid, source })).resolves.toMatchObject({ ...valid, source })
  })

  it('接受长度边界、空的可选文本和本机 HTTP 地址', async () => {
    await expect(
      validate({
        ...valid,
        message: '错'.repeat(1000),
        url: `https://blog.example.com/${'a'.repeat(2023)}`,
        stack: '栈'.repeat(4000),
        info: '信'.repeat(200),
      }),
    ).resolves.toBeInstanceOf(ClientErrorDto)
    await expect(validate({ ...valid, url: 'http://localhost:3456/', stack: '', info: '' })).resolves.toBeInstanceOf(
      ClientErrorDto,
    )
  })

  it.each([
    {},
    { ...valid, source: 'server' },
    { ...valid, source: ['window'] },
    { ...valid, message: '' },
    { ...valid, message: ' \n\t\u0000\u200b' },
    { ...valid, message: 1 },
    { ...valid, message: '错'.repeat(1001) },
    { ...valid, message: '😀'.repeat(501) },
    { ...valid, url: 'https://blog.example.com/' + 'a'.repeat(2025) },
    { ...valid, url: '/posts' },
    { ...valid, url: 'javascript:alert(1)' },
    { ...valid, url: 'ftp://blog.example.com/file' },
    { ...valid, url: '//blog.example.com/posts' },
    { ...valid, url: null },
    { ...valid, stack: 'a'.repeat(4001) },
    { ...valid, stack: null },
    { ...valid, stack: { token: 'secret' } },
    { ...valid, info: 'a'.repeat(201) },
    { ...valid, info: null },
    { ...valid, info: ['mounted'] },
    { ...valid, userId: 'must-not-be-accepted' },
    [valid],
    null,
  ])('拒绝非法字段、未知字段及超限数据 %#', async (body) => {
    await expect(validate(body)).rejects.toMatchObject({ status: 400 })
  })
})
