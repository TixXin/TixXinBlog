/** @file moment-dto.spec.ts @description 朋友圈写入、引用卡片、评论、点赞和版本 DTO 的严格边界。 */
import { plainToInstance } from 'class-transformer'
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { MOMENT_COMMENT_STATUSES } from '../../entities/moment-comment.entity'
import { MOMENT_STATUSES } from '../../entities/moment.entity'
import {
  CreateMomentCommentDto,
  ModerateMomentCommentDto,
  MomentCommentBody,
  MomentLinkDto,
  MomentRevisionDto,
  SaveMomentDto,
  SetMomentLikeDto,
} from './moment.dto'

const requestId = '12345678-1234-4123-8123-123456789abc'
const link = { url: 'https://example.com/', title: '相关阅读' }

describe('朋友圈引用卡片 DTO', () => {
  it.each([
    ['url', 2048, true],
    ['title', 160, true],
    ['description', 500, false],
    ['image', 2048, false],
    ['siteName', 80, false],
    ['favicon', 2048, false],
  ] as const)('%s 校验长度和类型', (field, max, required) => {
    expectDtoValid(MomentLinkDto, { ...link, [field]: '字'.repeat(max) })
    expectDtoInvalid(MomentLinkDto, { ...link, [field]: '字'.repeat(max + 1) }, field, 'maxLength')
    if (required) {
      expectDtoValid(MomentLinkDto, { ...link, [field]: ' 字 ' })
      expectDtoInvalid(MomentLinkDto, { ...link, [field]: ' \n\t ' }, field, 'minLength')
      expectDtoInvalid(MomentLinkDto, { ...link, [field]: undefined }, field, 'isString')
      expectDtoInvalid(MomentLinkDto, { ...link, [field]: null }, field, 'isString')
    } else {
      expectDtoValid(MomentLinkDto, { ...link, [field]: '' })
    }
    for (const value of [1, false, {}, []])
      expectDtoInvalid(MomentLinkDto, { ...link, [field]: value }, field, 'isString')
  })

  it('拒绝卡片中的未声明字段', () => {
    expectDtoInvalid(MomentLinkDto, { ...link, html: '<script></script>' }, 'html', 'whitelistValidation')
  })
})

describe('朋友圈保存 DTO', () => {
  it('接受局部更新与显式清除可空字段', () => {
    expectDtoValid(SaveMomentDto, {})
    expectDtoValid(SaveMomentDto, { requestId, revision: 0, content: ' 正文 ', linkedLink: link })
    expectDtoValid(SaveMomentDto, { location: null, device: null, mood: null, linkedArticleId: null, linkedLink: null })
    expect(plainToInstance(SaveMomentDto, { content: ' 正文 ', location: ' 书房 ' })).toMatchObject({
      content: '正文',
      location: '书房',
    })
  })

  it.each([
    ['content', 10000],
    ['location', 160],
    ['device', 80],
    ['mood', 80],
  ] as const)('%s 裁剪后检查长度和类型', (field, max) => {
    expectDtoValid(SaveMomentDto, { [field]: ` ${'字'.repeat(max)} ` })
    expectDtoInvalid(SaveMomentDto, { [field]: '字'.repeat(max + 1) }, field, 'maxLength')
    for (const value of [1, false, [], {}]) expectDtoInvalid(SaveMomentDto, { [field]: value }, field, 'isString')
    if (field === 'content') {
      expectDtoValid(SaveMomentDto, { content: ' 字 ' })
      expectDtoInvalid(SaveMomentDto, { content: ' \n\t ' }, 'content', 'minLength')
      expectDtoInvalid(SaveMomentDto, { content: null }, 'content', 'isString')
    } else {
      expectDtoValid(SaveMomentDto, { [field]: '' })
    }
  })

  it.each([
    ['topics', 10, 40],
    ['images', 9, 2048],
  ] as const)('%s 检查数组数量、元素长度及错误类型', (field, count, max) => {
    expectDtoValid(SaveMomentDto, { [field]: [] })
    expectDtoValid(SaveMomentDto, { [field]: Array.from({ length: count }, () => 'a'.repeat(max)) })
    expectDtoInvalid(SaveMomentDto, { [field]: Array.from({ length: count + 1 }, () => 'a') }, field, 'arrayMaxSize')
    expectDtoInvalid(SaveMomentDto, { [field]: ['a'.repeat(max + 1)] }, field, 'maxLength')
    for (const value of [null, 'a', 1, {}]) expectDtoInvalid(SaveMomentDto, { [field]: value }, field, 'isArray')
    for (const value of [null, 1, false, {}, []])
      expectDtoInvalid(SaveMomentDto, { [field]: [value] }, field, 'isString')
  })

  it('检查 UUID v4、整数版本及文章编号', () => {
    expectDtoValid(SaveMomentDto, { requestId, revision: 0, linkedArticleId: 1 })
    for (const value of [null, '', 1, '12345678-1234-1123-8123-123456789abc']) {
      expectDtoInvalid(SaveMomentDto, { requestId: value }, 'requestId', 'isUuid')
    }
    expectDtoInvalid(SaveMomentDto, { revision: -1 }, 'revision', 'min')
    expectDtoInvalid(SaveMomentDto, { linkedArticleId: 0 }, 'linkedArticleId', 'min')
    for (const field of ['revision', 'linkedArticleId']) {
      for (const value of ['1', 1.5, false, {}, []]) expectDtoInvalid(SaveMomentDto, { [field]: value }, field, 'isInt')
    }
    expectDtoInvalid(SaveMomentDto, { revision: null }, 'revision', 'isInt')
  })

  it('枚举和布尔值不接受字符串模拟或空值', () => {
    for (const status of MOMENT_STATUSES) expectDtoValid(SaveMomentDto, { status })
    for (const status of [null, 'hidden', 'PUBLISHED', '', 1, false])
      expectDtoInvalid(SaveMomentDto, { status }, 'status', 'isIn')
    for (const isPinned of [true, false]) expectDtoValid(SaveMomentDto, { isPinned })
    for (const isPinned of [null, 'true', 'false', 1, 0, {}])
      expectDtoInvalid(SaveMomentDto, { isPinned }, 'isPinned', 'isBoolean')
  })

  it('引用卡片必须是单个 DTO 对象并递归拒绝额外字段', () => {
    expectDtoInvalid(SaveMomentDto, { linkedLink: { ...link, title: '' } }, 'linkedLink.title', 'minLength')
    expectDtoInvalid(SaveMomentDto, { linkedLink: { ...link, owner: true } }, 'linkedLink.owner', 'whitelistValidation')
    for (const linkedLink of [[], [link], 'link', 1, false]) {
      expectDtoInvalid(SaveMomentDto, { linkedLink }, 'linkedLink', 'isObject')
    }
    for (const field of ['author', 'likes', 'publishedAt']) {
      expectDtoInvalid(SaveMomentDto, { [field]: 1 }, field, 'whitelistValidation')
    }
  })
})

describe('朋友圈删除版本与点赞 DTO', () => {
  it('删除版本接受查询字符串零并拒绝负数、非整数及额外字段', () => {
    expectDtoValid(MomentRevisionDto, { revision: 0 })
    expectDtoValid(MomentRevisionDto, { revision: '0' })
    expectDtoInvalid(MomentRevisionDto, { revision: -1 }, 'revision', 'min')
    for (const revision of [undefined, null, 0.5, '', ' \t ', true, false, 'abc', {}, []])
      expectDtoInvalid(MomentRevisionDto, { revision }, 'revision', 'isInt')
    expectDtoInvalid(MomentRevisionDto, { revision: 0, force: true }, 'force', 'whitelistValidation')
  })

  it('点赞目标只接受布尔值且不能提交计数', () => {
    for (const liked of [true, false]) expectDtoValid(SetMomentLikeDto, { liked })
    for (const liked of [undefined, null, 'true', 'false', 0, 1, {}, []])
      expectDtoInvalid(SetMomentLikeDto, { liked }, 'liked', 'isBoolean')
    expectDtoInvalid(SetMomentLikeDto, { liked: true, likes: 100 }, 'likes', 'whitelistValidation')
  })
})

describe.each([MomentCommentBody, CreateMomentCommentDto].map((Dto) => ({ name: Dto.name, Dto })))(
  '朋友圈评论 $name',
  ({ Dto }) => {
    const valid = { requestId, content: '评论', ...(Dto === CreateMomentCommentDto ? { author: '访客' } : {}) }

    it('必填提交标识和正文继承相同 UUID、裁剪及长度规则', () => {
      expectDtoValid(Dto, { ...valid, content: ' 字 ' })
      expectDtoValid(Dto, { ...valid, content: ` ${'字'.repeat(1000)} ` })
      expectDtoInvalid(Dto, { ...valid, content: ' \n\t ' }, 'content', 'minLength')
      expectDtoInvalid(Dto, { ...valid, content: '字'.repeat(1001) }, 'content', 'maxLength')
      for (const content of [undefined, null, 1, false, {}, []])
        expectDtoInvalid(Dto, { ...valid, content }, 'content', 'isString')
      for (const value of [undefined, null, '', 1, '12345678-1234-1123-8123-123456789abc']) {
        expectDtoInvalid(Dto, { ...valid, requestId: value }, 'requestId', 'isUuid')
      }
      expectDtoInvalid(Dto, { ...valid, isOwner: true }, 'isOwner', 'whitelistValidation')
    })
  },
)

describe('公开朋友圈评论及审核 DTO', () => {
  const valid = { requestId, content: '评论', author: '访客' }

  it('昵称检查裁剪后 1–32 字符，头像可选且最长 2048 字符', () => {
    expectDtoValid(CreateMomentCommentDto, { ...valid, author: ' 字 ', avatar: '' })
    expectDtoValid(CreateMomentCommentDto, { ...valid, author: ` ${'字'.repeat(32)} `, avatar: 'a'.repeat(2048) })
    expectDtoInvalid(CreateMomentCommentDto, { ...valid, author: ' \t ' }, 'author', 'minLength')
    expectDtoInvalid(CreateMomentCommentDto, { ...valid, author: '字'.repeat(33) }, 'author', 'maxLength')
    expectDtoInvalid(CreateMomentCommentDto, { ...valid, avatar: 'a'.repeat(2049) }, 'avatar', 'maxLength')
    for (const value of [1, false, {}, []]) {
      for (const field of ['author', 'avatar'])
        expectDtoInvalid(CreateMomentCommentDto, { ...valid, [field]: value }, field, 'isString')
    }
    for (const author of [undefined, null])
      expectDtoInvalid(CreateMomentCommentDto, { ...valid, author }, 'author', 'isString')
    expectDtoInvalid(
      MomentCommentBody,
      { requestId, content: '博主回复', author: '冒名' },
      'author',
      'whitelistValidation',
    )
  })

  it('审核的目标和预期状态都必须来自正式枚举', () => {
    for (const status of MOMENT_COMMENT_STATUSES) {
      for (const expectedStatus of MOMENT_COMMENT_STATUSES)
        expectDtoValid(ModerateMomentCommentDto, { status, expectedStatus })
    }
    for (const field of ['status', 'expectedStatus']) {
      for (const value of [undefined, null, '', 'spam', 'PUBLISHED', 1, false]) {
        expectDtoInvalid(
          ModerateMomentCommentDto,
          { status: 'published', expectedStatus: 'pending', [field]: value },
          field,
          'isIn',
        )
      }
    }
    expectDtoInvalid(
      ModerateMomentCommentDto,
      { status: 'published', expectedStatus: 'pending', revision: 0 },
      'revision',
      'whitelistValidation',
    )
  })
})
