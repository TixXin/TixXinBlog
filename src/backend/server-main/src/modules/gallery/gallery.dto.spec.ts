/** @file gallery.dto.spec.ts @description 图库查询、保存及器材配置的请求校验边界 */
import 'reflect-metadata'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminGalleryQuery, GalleryQuery, SaveGalleryDto, SaveGallerySettingsDto } from './gallery.dto'

const mediaId = '12345678-1234-4123-a123-123456789abc'
const requestId = '87654321-4321-4321-b321-cba987654321'

describe('图库查询 DTO', () => {
  it('默认每页十二条，转换数字参数并保留未分类与全部的区别', () => {
    const defaults = plainToInstance(GalleryQuery, {})
    expect(defaults).toMatchObject({ page: 1, pageSize: 12 })
    expect(defaults.category).toBeUndefined()
    expect(validateSync(defaults)).toEqual([])

    const query = plainToInstance(GalleryQuery, { page: '10000', pageSize: '48', q: '  海边  ', category: '  ' })
    expect(query).toMatchObject({ page: 10000, pageSize: 48, q: '海边', category: '' })
    expect(validateSync(query)).toEqual([])
  })

  it.each([
    ['page', '0'],
    ['page', '10001'],
    ['page', '1.5'],
    ['page', 'abc'],
    ['pageSize', '0'],
    ['pageSize', '49'],
    ['pageSize', '1.5'],
    ['q', '字'.repeat(201)],
    ['q', null],
    ['category', '字'.repeat(41)],
    ['category', null],
  ])('拒绝超出契约的 %s 查询参数', (field, value) => {
    const errors = validateSync(plainToInstance(GalleryQuery, { [field]: value }))
    expect(errors.map((error) => error.property)).toContain(field)
  })

  it('管理查询允许全部及三个发布状态，拒绝无效状态', () => {
    for (const status of ['all', 'draft', 'published', 'withdrawn']) {
      expect(validateSync(plainToInstance(AdminGalleryQuery, { status }))).toEqual([])
    }
    expect(validateSync(plainToInstance(AdminGalleryQuery, { status: 'archived' }))).toEqual([
      expect.objectContaining({ property: 'status' }),
    ])
  })
})

describe('图库保存 DTO', () => {
  it('保留局部更新语义，允许明确清空来源和未知拍摄日期', () => {
    const input = plainToInstance(SaveGalleryDto, {
      revision: 0,
      title: '  山间清晨  ',
      description: '  日出前的山谷  ',
      category: '  风光  ',
      location: '  山顶  ',
      device: '  相机  ',
      mediaId: null,
      externalUrl: null,
      takenOn: null,
    })
    expect(validateSync(input)).toEqual([])
    expect(input).toMatchObject({
      revision: 0,
      title: '山间清晨',
      description: '日出前的山谷',
      category: '风光',
      location: '山顶',
      device: '相机',
      mediaId: null,
      externalUrl: null,
      takenOn: null,
    })
    expect(input.requestId).toBeUndefined()
    expect(input.status).toBeUndefined()
    // 来源的最终互斥由服务结合已存记录判断；DTO 仅负责字段类型和格式。
    expect(validateSync(plainToInstance(SaveGalleryDto, {}))).toEqual([])
  })

  it('接受合法 UUID、闰日及排序上下界', () => {
    for (const sortOrder of [-1000000, 1000000]) {
      expect(
        validateSync(
          plainToInstance(SaveGalleryDto, {
            requestId,
            mediaId,
            title: '雨后的街道',
            takenOn: '2024-02-29',
            status: 'published',
            sortOrder,
          }),
        ),
      ).toEqual([])
    }
  })

  it.each(['title', 'description', 'category', 'location', 'device', 'status', 'sortOrder', 'revision', 'requestId'])(
    '%s 不接受 null 绕过保存校验',
    (field) => {
      expect(validateSync(plainToInstance(SaveGalleryDto, { [field]: null }))).toEqual([
        expect.objectContaining({ property: field }),
      ])
    },
  )

  it.each([
    ['title', '  '],
    ['mediaId', 'not-a-uuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc'],
    ['revision', -1],
    ['revision', 1.5],
    ['status', 'archived'],
    ['sortOrder', 1000001],
    ['sortOrder', -1000001],
    ['externalUrl', 123],
    ['externalUrl', 'x'.repeat(2049)],
    ['takenOn', '2025-02-29'],
    ['takenOn', '2026-04-31'],
    ['takenOn', '2026-1-01'],
    ['takenOn', '2026-01-01T00:00:00Z'],
    ['takenOn', ''],
  ])('拒绝非法保存字段 %s', (field, value) => {
    expect(validateSync(plainToInstance(SaveGalleryDto, { [field]: value }))).toEqual([
      expect.objectContaining({ property: field }),
    ])
  })

  it.each(['width', 'height', 'format', 'publishedAt', 'deletedAt', 'requestHash'])(
    '请求白名单禁止客户端伪造 %s',
    async (field) => {
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
      await expect(
        pipe.transform({ title: '山间清晨', [field]: '伪造值' }, { type: 'body', metatype: SaveGalleryDto }),
      ).rejects.toBeInstanceOf(BadRequestException)
    },
  )
})

describe('图库器材配置 DTO', () => {
  const gear = { icon: 'lucide:camera', name: '  随身相机  ', description: '  记录日常  ' }

  it('支持清空器材和最多十二项，并校验嵌套字段', () => {
    expect(validateSync(plainToInstance(SaveGallerySettingsDto, { revision: 0, gear: [] }))).toEqual([])
    const input = plainToInstance(SaveGallerySettingsDto, { revision: 1, gear: Array(12).fill(gear) })
    expect(validateSync(input)).toEqual([])
    expect(input.gear[0]).toMatchObject({ icon: 'lucide:camera', name: '随身相机', description: '记录日常' })
  })

  it.each([
    ['缺少版本', { gear: [] }, 'revision'],
    ['负数版本', { revision: -1, gear: [] }, 'revision'],
    ['缺少器材列表', { revision: 0 }, 'gear'],
    ['空值列表', { revision: 0, gear: null }, 'gear'],
    ['超过十二项', { revision: 0, gear: Array(13).fill(gear) }, 'gear'],
    ['不允许的图标', { revision: 0, gear: [{ ...gear, icon: 'other:camera' }] }, 'gear'],
    ['空名称', { revision: 0, gear: [{ ...gear, name: '  ' }] }, 'gear'],
    ['缺少说明', { revision: 0, gear: [{ icon: gear.icon, name: gear.name }] }, 'gear'],
  ])('拒绝%s', (_name, input, field) => {
    expect(validateSync(plainToInstance(SaveGallerySettingsDto, input))).toEqual([
      expect.objectContaining({ property: field }),
    ])
  })
})
