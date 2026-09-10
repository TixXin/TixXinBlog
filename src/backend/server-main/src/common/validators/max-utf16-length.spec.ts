/** @file max-utf16-length.spec.ts @description 三域DTO与内容包长度合同，覆盖非BMP、变体序列及嵌套文本 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import type { ValidationError } from 'class-validator'
import { SaveGalleryDto, SaveGallerySettingsDto } from '../../modules/gallery/gallery.dto'
import { SaveProjectDto } from '../../modules/project/project.dto'
import { SaveLinkDto, SaveLinkSettingsDto } from '../../modules/link/link.dto'

type Dto = SaveGalleryDto | SaveGallerySettingsDto | SaveProjectDto | SaveLinkDto | SaveLinkSettingsDto
type Boundary = { name: string; max: number; create: (value: unknown) => Dto }
const boundaries: Boundary[] = [
  ...Object.entries({ title: 160, description: 5000, category: 40, location: 160, device: 160 }).map(([key, max]) => ({
    name: `gallery.${key}`,
    max,
    create: (value: unknown) => plainToInstance(SaveGalleryDto, { [key]: value }),
  })),
  ...Object.entries({ name: 80, description: 300 }).map(([key, max]) => ({
    name: `gallerySettings.gear.${key}`,
    max,
    create: (value: unknown) =>
      plainToInstance(SaveGallerySettingsDto, {
        revision: 0,
        gear: [{ icon: 'lucide:camera', name: '相机', description: '', [key]: value }],
      }),
  })),
  ...Object.entries({ title: 160, description: 5000 }).map(([key, max]) => ({
    name: `projects.${key}`,
    max,
    create: (value: unknown) => plainToInstance(SaveProjectDto, { [key]: value }),
  })),
  {
    name: 'projects.tags.label',
    max: 40,
    create: (value) => plainToInstance(SaveProjectDto, { tags: [{ label: value, color: 'sky' }] }),
  },
  ...Object.entries({ name: 80, description: 300 }).map(([key, max]) => ({
    name: `links.${key}`,
    max,
    create: (value: unknown) => plainToInstance(SaveLinkDto, { [key]: value }),
  })),
  {
    name: 'linkSettings.rules',
    max: 300,
    create: (value) => plainToInstance(SaveLinkSettingsDto, { revision: 0, rules: ['现有规则', value] }),
  },
]
function constraints(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [...Object.keys(error.constraints ?? {}), ...constraints(error.children ?? [])])
}

describe.each(boundaries)('$name 的持久化长度边界', ({ max, create }) => {
  it('接受边界内的BMP、非BMP和变体序列，保留原文本', () => {
    for (const text of ['长'.repeat(max), '𠮷'.repeat(max / 2), '✈️'.repeat(max / 2)]) {
      const input = create(text)
      expect(validateSync(input)).toEqual([])
      expect(JSON.stringify(input)).toContain(text)
    }
  })
  it('拒绝多出一个UTF16单元的非BMP与变体序列', () => {
    for (const text of ['𠮷'.repeat(max / 2) + '长', '✈️'.repeat(max / 2) + '长']) {
      expect(constraints(validateSync(create(text)))).toContain('maxUtf16Length')
    }
  })
  it('保留类型验证并在长度验证前按既有规则trim', () => {
    expect(constraints(validateSync(create(1)))).toContain('isString')
    expect(validateSync(create(` ${'𠮷'.repeat(max / 2)} `))).toEqual([])
  })
})

it('保留必填文本非空与PATCH省略字段语义', () => {
  expect(constraints(validateSync(plainToInstance(SaveGalleryDto, { title: ' ' })))).toContain('minLength')
  expect(constraints(validateSync(plainToInstance(SaveProjectDto, { tags: [{ label: '', color: 'sky' }] })))).toContain(
    'minLength',
  )
  expect(constraints(validateSync(plainToInstance(SaveLinkSettingsDto, { revision: 0, rules: [''] })))).toContain(
    'minLength',
  )
  for (const input of [new SaveGalleryDto(), new SaveProjectDto(), new SaveLinkDto()])
    expect(validateSync(input)).toEqual([])
})
