/**
 * @file about-settings.ts
 * @description 关于页可维护资料；排序由数组顺序决定，公开读取剔除隐藏条目。
 *              v17 起可选携带条目链接、英文资料、“现在”与“装备与工具”栏目、本站信息开关与支持方式，
 *              旧数据缺少这些键时按空值读取。
 */
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export const ABOUT_SECTION_KINDS = ['experience', 'skill', 'interest', 'reading', 'now', 'uses'] as const
export type AboutSectionKind = (typeof ABOUT_SECTION_KINDS)[number]
/** v17 新增的栏目，旧版内容包出现即拒绝 */
export const ABOUT_V17_SECTION_KINDS: readonly AboutSectionKind[] = ['now', 'uses']

/** 条目链接只接受不带账号信息的 http(s) 地址；空串表示没有链接 */
const HTTP_URL = /^(?:$|https?:\/\/[^\s/@]+(?:\/[^\s]*)?$)/
/** 支持方式的图片：站内路径或 https 地址（http 图片会被浏览器按混合内容拦截），空串表示没有图片 */
const IMAGE_URL = /^(?:$|\/(?!\/)[^\\\s]*$|https:\/\/[^\s/@]+(?:\/[^\s]*)?$)/

export class AboutItemTranslationDto {
  @IsString() @MaxLength(120) title!: string
  @IsString() @MaxLength(1000) detail!: string
  @IsString() @MaxLength(80) period!: string
}
export class AboutItemDto {
  @IsString() @MaxLength(120) title!: string
  @IsString() @MaxLength(1000) detail!: string
  @IsString() @MaxLength(80) period!: string
  @IsBoolean() visible!: boolean
  @IsOptional() @IsString() @MaxLength(500) @Matches(HTTP_URL) url?: string
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AboutItemTranslationDto) en?: AboutItemTranslationDto
}
export class AboutSectionDto {
  @IsIn(ABOUT_SECTION_KINDS) kind!: AboutSectionKind
  @IsBoolean() visible!: boolean
  /** 栏目最近更新日期 YYYY-MM-DD，用于“现在”栏目；空串表示不显示 */
  @IsOptional() @IsString() @Matches(/^(?:$|\d{4}-\d{2}-\d{2})$/) updatedAt?: string
  @IsArray()
  @ArrayMaxSize(30)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AboutItemDto)
  items!: AboutItemDto[]
}
export class AboutTranslationDto {
  @IsString() @MaxLength(5000) introduction!: string
}
export class AboutSupportMethodDto {
  @IsString() @MaxLength(40) label!: string
  @IsString() @MaxLength(500) @Matches(HTTP_URL) url!: string
  @IsString() @MaxLength(1000) @Matches(IMAGE_URL) image!: string
}
export class AboutSupportDto {
  @IsBoolean() visible!: boolean
  @IsString() @MaxLength(300) message!: string
  @IsOptional() @IsString() @MaxLength(300) messageEn?: string
  @IsArray()
  @ArrayMaxSize(6)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AboutSupportMethodDto)
  methods!: AboutSupportMethodDto[]
}
export class AboutSettingsDto {
  @IsBoolean() visible!: boolean
  @IsString() @MaxLength(5000) introduction!: string
  @IsArray()
  @ArrayMaxSize(ABOUT_SECTION_KINDS.length)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AboutSectionDto)
  sections!: AboutSectionDto[]
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AboutTranslationDto) en?: AboutTranslationDto
  /** 是否在关于页展示本站信息（运行天数与内容统计），统计从实际记录计算 */
  @IsOptional() @IsBoolean() showSiteInfo?: boolean
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AboutSupportDto) support?: AboutSupportDto
}
export function emptyAbout(): AboutSettingsDto {
  return { visible: false, introduction: '', sections: [] }
}
/** 一组支持方式至少要有标签，并且有链接或图片之一才算可用 */
function usableMethods(support: AboutSupportDto) {
  return support.methods.filter((method) => method.label.trim() && (method.url || method.image))
}
/** 支持方式独立于关于页是否公开：它也出现在文章页侧栏 */
function publicSupport(support: AboutSupportDto | undefined): AboutSupportDto | undefined {
  if (!support?.visible) return undefined
  const methods = usableMethods(support)
  return methods.length ? { ...support, methods } : undefined
}
export function publicAbout(value: AboutSettingsDto | undefined): AboutSettingsDto {
  const support = publicSupport(value?.support)
  if (!value?.visible) return { ...emptyAbout(), ...(support ? { support } : {}) }
  return {
    visible: true,
    introduction: value.introduction,
    sections: value.sections
      .filter((section) => section.visible)
      .map((section) => ({ ...section, items: section.items.filter((item) => item.visible && item.title.trim()) }))
      .filter((section) => section.items.length),
    ...(value.en ? { en: value.en } : {}),
    ...(value.showSiteInfo ? { showSiteInfo: true } : {}),
    ...(support ? { support } : {}),
  }
}
/** 站点资料里引用的全部图片：头像与支持方式的收款图，供受管媒体引用登记与迁入核对 */
export function siteImageValues(values: { avatar: string; about?: AboutSettingsDto }): string[] {
  return [values.avatar, ...(values.about?.support?.methods.map((method) => method.image) ?? [])]
}
/** v1–v16 内容包的关于页不得出现 v17 字段，出现即视为未知字段 */
export function aboutUsesV17Fields(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const about = raw as Record<string, unknown>
  if (['en', 'showSiteInfo', 'support'].some((key) => key in about)) return true
  const sections = Array.isArray(about.sections) ? (about.sections as unknown[]) : []
  return sections.some((section) => {
    if (!section || typeof section !== 'object') return false
    const value = section as Record<string, unknown>
    if ('updatedAt' in value || ABOUT_V17_SECTION_KINDS.includes(value.kind as AboutSectionKind)) return true
    const items = Array.isArray(value.items) ? (value.items as unknown[]) : []
    return items.some((item) => !!item && typeof item === 'object' && ('url' in item || 'en' in item))
  })
}
