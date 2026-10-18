/** @file media.dto.spec.ts @description 媒体上传和编辑 DTO 的文本、提交标识与白名单边界，不触发文件上传。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { UpdateMediaDto, UploadMediaDto } from './media.controller'

describe('媒体写入 DTO', () => {
  it('上传接受缺省替代文本和 UUID v4，拒绝无效提交标识及服务端字段', () => {
    expectDtoValid(UploadMediaDto, {})
    expectDtoValid(UploadMediaDto, { uploadId: '12345678-1234-4234-8234-123456789abc' })
    for (const uploadId of ['', 1, [], '12345678-1234-1234-8234-123456789abc']) {
      expectDtoInvalid(UploadMediaDto, { uploadId }, 'uploadId', 'isUuid')
    }
    expectDtoInvalid(UploadMediaDto, { storageKey: 'injected.webp' }, 'storageKey', 'whitelistValidation')
  })

  it('上传替代文本接受 0–300 字，拒绝超长、null 和非字符串', () => {
    for (const alt of ['', '文'.repeat(300)]) expectDtoValid(UploadMediaDto, { alt })
    expectDtoInvalid(UploadMediaDto, { alt: '文'.repeat(301) }, 'alt', 'maxLength')
    for (const alt of [null, 1, false, [], {}]) expectDtoInvalid(UploadMediaDto, { alt }, 'alt', 'isString')
  })

  it.each([
    ['alt', 300],
    ['description', 1000],
  ] as const)('编辑 %s 接受空串清空，但不接受 null、越界和错误类型', (field, maximum) => {
    expectDtoValid(UpdateMediaDto, {})
    for (const length of [0, maximum]) expectDtoValid(UpdateMediaDto, { [field]: '文'.repeat(length) })
    expectDtoInvalid(UpdateMediaDto, { [field]: '文'.repeat(maximum + 1) }, field, 'maxLength')
    for (const value of [null, 1, false, [], {}])
      expectDtoInvalid(UpdateMediaDto, { [field]: value }, field, 'isString')
  })

  it('编辑不能注入上传身份或持久属性', () => {
    expectDtoInvalid(
      UpdateMediaDto,
      { uploadId: '12345678-1234-4234-8234-123456789abc' },
      'uploadId',
      'whitelistValidation',
    )
    expectDtoInvalid(UpdateMediaDto, { width: 100 }, 'width', 'whitelistValidation')
  })
})
