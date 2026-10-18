/** @file gallery-write.dto.spec.ts @description 图库写入、器材设置及删除版本的严格 DTO 边界回归。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { GALLERY_STATUSES } from '../../entities/gallery-photo.entity'
import { GALLERY_GEAR_ICONS } from '../../entities/gallery-settings.entity'
import { GalleryGearDto, GalleryRevisionDto, SaveGalleryDto, SaveGallerySettingsDto } from './gallery.dto'
import { galleryExternalUrl } from './gallery-values'

const uuid = '12345678-1234-4123-a123-123456789abc'
const gear = { icon: 'lucide:camera', name: '相机', description: '' }

describe('图库写入 DTO', () => {
  it('允许局部更新、省略字段及显式清空图片来源', () => {
    expectDtoValid(SaveGalleryDto, {})
    expectDtoValid(SaveGalleryDto, { title: '字' })
    expectDtoValid(SaveGalleryDto, {
      requestId: uuid,
      revision: 0,
      mediaId: null,
      externalUrl: 'https://example.com/photo.jpg',
      title: ' 城市清晨 ',
      description: '',
      category: '',
      takenOn: '2024-02-29',
      location: '',
      device: '',
      status: 'draft',
      sortOrder: 0,
      relatedContent: [{ type: 'post', id: 1 }],
    })
    expectDtoValid(SaveGalleryDto, { mediaId: uuid, externalUrl: null, takenOn: null, relatedContent: [] })
  })

  it.each([
    ['title', 160],
    ['description', 5000],
    ['category', 40],
    ['location', 160],
    ['device', 160],
    ['externalUrl', 2048],
  ] as const)('%s 按 UTF-16 接受上限并拒绝超长文本和错误类型', (field, max) => {
    expectDtoValid(SaveGalleryDto, { [field]: '字'.repeat(max) })
    expectDtoValid(SaveGalleryDto, { [field]: '📷'.repeat(max / 2) })
    expectDtoInvalid(SaveGalleryDto, { [field]: '字'.repeat(max + 1) }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveGalleryDto, { [field]: '📷'.repeat(max / 2) + '字' }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveGalleryDto, { [field]: 123 }, field, 'isString')
  })

  it.each(['', '   '])('标题不接受空白 %j', (title) => {
    expectDtoInvalid(SaveGalleryDto, { title }, 'title', 'minLength')
  })

  it.each(['title', 'description', 'category', 'location', 'device'])('%s 不接受 null', (field) => {
    expectDtoInvalid(SaveGalleryDto, { [field]: null }, field, 'isString')
  })

  it.each(GALLERY_STATUSES)('接受发布状态 %s', (status) => expectDtoValid(SaveGalleryDto, { status }))

  it.each([
    ['requestId', 'not-a-uuid', 'isUuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc', 'isUuid'],
    ['requestId', null, 'isUuid'],
    ['mediaId', 123, 'isUuid'],
    ['mediaId', '', 'isUuid'],
    ['revision', -1, 'min'],
    ['revision', 0.5, 'isInt'],
    ['revision', '0', 'isInt'],
    ['revision', null, 'isInt'],
    ['status', 'all', 'isIn'],
    ['status', 1, 'isIn'],
    ['sortOrder', -1000001, 'min'],
    ['sortOrder', 1000001, 'max'],
    ['sortOrder', 1.5, 'isInt'],
    ['sortOrder', '1', 'isInt'],
    ['takenOn', '2023-02-29', 'isDateString'],
    ['takenOn', '2024-02-29T00:00:00Z', 'matches'],
    ['takenOn', 20240229, 'isDateString'],
  ] as const)('拒绝 %s 的非法值 %j', (field, value, constraint) => {
    expectDtoInvalid(SaveGalleryDto, { [field]: value }, field, constraint)
  })

  it('接受排序上下限，拒绝伪造尺寸和发布信息', () => {
    for (const sortOrder of [-1000000, 1000000]) expectDtoValid(SaveGalleryDto, { sortOrder })
    for (const field of ['width', 'height', 'publishedAt', 'unknown'])
      expectDtoInvalid(SaveGalleryDto, { [field]: 1 }, field, 'whitelistValidation')
  })

  it('关联数组接受空值和十二项，并检查容器及嵌套白名单', () => {
    expectDtoValid(SaveGalleryDto, {
      relatedContent: Array.from({ length: 12 }, (_, i) => ({ type: 'post', id: i + 1 })),
    })
    expectDtoInvalid(
      SaveGalleryDto,
      { relatedContent: Array(13).fill({ type: 'post', id: 1 }) },
      'relatedContent',
      'arrayMaxSize',
    )
    expectDtoInvalid(SaveGalleryDto, { relatedContent: {} }, 'relatedContent', 'isArray')
    expectDtoInvalid(SaveGalleryDto, { relatedContent: [[]] }, 'relatedContent', 'isObject')
    expectDtoInvalid(
      SaveGalleryDto,
      { relatedContent: [{ type: 'post', id: 1, title: '伪造标题' }] },
      'relatedContent.0.title',
      'whitelistValidation',
    )
    expectDtoInvalid(SaveGalleryDto, { relatedContent: [{ type: 'unknown', id: 0 }] }, 'relatedContent.0.type', 'isIn')
    expectDtoInvalid(SaveGalleryDto, { relatedContent: [{ type: 'post', id: 0 }] }, 'relatedContent.0.id', 'min')
  })
})

describe('图库器材与设置 DTO', () => {
  it.each(GALLERY_GEAR_ICONS)('接受器材图标 %s', (icon) => expectDtoValid(GalleryGearDto, { ...gear, icon }))

  it.each([
    ['name', 80],
    ['description', 300],
  ] as const)('%s 按 UTF-16 检查长度及类型', (field, max) => {
    expectDtoValid(GalleryGearDto, { ...gear, [field]: '📷'.repeat(max / 2) })
    expectDtoInvalid(GalleryGearDto, { ...gear, [field]: '📷'.repeat(max / 2) + '字' }, field, 'maxUtf16Length')
    expectDtoInvalid(GalleryGearDto, { ...gear, [field]: 1 }, field, 'isString')
  })

  it('器材必填字段、空白名称、枚举和多余字段不能绕过校验', () => {
    expectDtoValid(GalleryGearDto, { ...gear, name: '字' })
    expectDtoInvalid(GalleryGearDto, {}, 'name', 'isString')
    expectDtoInvalid(GalleryGearDto, { ...gear, name: ' ' }, 'name', 'minLength')
    expectDtoInvalid(GalleryGearDto, { ...gear, icon: 'camera' }, 'icon', 'isIn')
    expectDtoInvalid(GalleryGearDto, { ...gear, icon: 1 }, 'icon', 'isIn')
    expectDtoInvalid(GalleryGearDto, { ...gear, unknown: true }, 'unknown', 'whitelistValidation')
  })

  it('设置接受空列表及十二项，上限外、错误类型与嵌套未知字段被拒绝', () => {
    expectDtoValid(SaveGallerySettingsDto, { revision: 0, gear: [] })
    expectDtoValid(SaveGallerySettingsDto, { revision: 1, gear: Array(12).fill(gear) })
    expectDtoInvalid(SaveGallerySettingsDto, { revision: 0, gear: Array(13).fill(gear) }, 'gear', 'arrayMaxSize')
    expectDtoInvalid(SaveGallerySettingsDto, { revision: 0, gear: {} }, 'gear', 'isArray')
    expectDtoInvalid(SaveGallerySettingsDto, { revision: 0, gear: [1] }, 'gear.0', 'nestedValidation')
    expectDtoInvalid(SaveGallerySettingsDto, { revision: 0, gear: [[]] }, 'gear', 'isObject')
    expectDtoInvalid(
      SaveGallerySettingsDto,
      { revision: 0, gear: [{ ...gear, unknown: true }] },
      'gear.0.unknown',
      'whitelistValidation',
    )
    expectDtoInvalid(SaveGallerySettingsDto, { revision: 0, gear: [], unknown: true }, 'unknown', 'whitelistValidation')
    expectDtoInvalid(SaveGallerySettingsDto, {}, 'revision', 'isInt')
    expectDtoInvalid(SaveGallerySettingsDto, {}, 'gear', 'isArray')
  })

  it.each([-1, 0.5, '0', null])('设置版本不接受 %j', (revision) => {
    expectDtoInvalid(SaveGallerySettingsDto, { revision, gear: [] }, 'revision', revision === -1 ? 'min' : 'isInt')
  })
})

describe('图库删除版本 DTO', () => {
  it('查询参数允许数字字符串并拒绝缺失和多余字段', () => {
    expectDtoValid(GalleryRevisionDto, { revision: '0' })
    expectDtoValid(GalleryRevisionDto, { revision: 1 })
    expectDtoInvalid(GalleryRevisionDto, {}, 'revision', 'isInt')
    expectDtoInvalid(GalleryRevisionDto, { revision: 0, unknown: true }, 'unknown', 'whitelistValidation')
  })

  it.each([-1, 0.5, 'invalid', null, '', ' ', true, false])('拒绝非法版本 %j', (revision) => {
    expectDtoInvalid(GalleryRevisionDto, { revision }, 'revision', revision === -1 ? 'min' : 'isInt')
  })
})

describe('图库地址协议边界', () => {
  // 地址语义由现有纯函数负责；DTO 单独约束输入类型和长度。
  it.each(['http://example.com/photo.jpg', 'https://example.com/photo.jpg'])('接受 %s', (url) => {
    expectDtoValid(SaveGalleryDto, { externalUrl: url })
    expect(galleryExternalUrl(url)).toBe(url)
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/a',
    'file:///tmp/a',
    'data:image/png;base64,a',
    '//example.com/a',
    'https://user:password@example.com/a',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\n',
  ])('拒绝危险或不完整地址 %j', (url) => {
    expect(() => galleryExternalUrl(url)).toThrow()
  })
})
