/**
 * @file site-settings.dto.ts
 * @description 站点资料字段与社交链接校验，图标限定为已支持的 Lucide 名称。
 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator'
import { AboutSettingsDto } from './about-settings'
import { SITE_LIMITS, SITE_NAV_KEYS, SiteFooterLinkDto, SiteNavItemDto } from './site-navigation'
/** 内置模块数加外链上限 */
const SITE_NAV_LIMIT = SITE_NAV_KEYS.length + SITE_LIMITS.externalNav
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
class SiteSocialDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) label!: string
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) href!: string
  @IsIn([
    'lucide:github',
    'lucide:twitter',
    'lucide:mail',
    'lucide:globe',
    'lucide:link',
    'lucide:rss',
    'lucide:youtube',
    'lucide:linkedin',
  ])
  icon!: string
}
export class ExpectedSiteRevisionDto {
  @IsInt() @Min(0) revision!: number
}
export class SaveSiteSettingsDto extends ExpectedSiteRevisionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => AboutSettingsDto)
  about?: AboutSettingsDto
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name!: string
  @Transform(trim) @IsString() @MaxLength(300) description!: string
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) ownerName!: string
  @Transform(trim) @IsString() @MaxLength(200) ownerTitle!: string
  @Transform(trim) @IsString() @MaxLength(1000) avatar!: string
  @Transform(trim) @IsString() @MaxLength(300) avatarAlt!: string
  @Transform(trim) @IsString() @MaxLength(160) seoTitle!: string
  @Transform(trim) @IsString() @MaxLength(320) seoDescription!: string
  @Transform(trim) @IsString() @MaxLength(1000) announcement!: string
  @IsArray()
  @ArrayMaxSize(8)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SiteSocialDto)
  socials!: SiteSocialDto[]
  // 以下几项为后加字段，旧客户端与旧内容包可以不带；缺省按空串处理
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  presenceLabel?: string
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  presenceSignature?: string
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: '上线日期需为 YYYY-MM-DD' })
  launchedAt?: string
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['', 'online', 'idle', 'busy'])
  presenceStatus?: '' | 'online' | 'idle' | 'busy'
  // 是否允许搜索引擎收录：缺省时沿用当前值，从未设置过的站点按允许处理
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  searchIndexing?: boolean
  // 导航、页脚、每日一言、备案与版权同为后加字段：缺省时沿用当前值；跨字段规则见 site-navigation.ts
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(SITE_NAV_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => SiteNavItemDto)
  navigation?: SiteNavItemDto[]
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(SITE_LIMITS.footerLinks)
  @ValidateNested({ each: true })
  @Type(() => SiteFooterLinkDto)
  footerLinks?: SiteFooterLinkDto[]
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(SITE_LIMITS.quotes)
  @IsString({ each: true })
  @MaxLength(SITE_LIMITS.quote, { each: true })
  quotes?: string[]
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(SITE_LIMITS.icpNumber)
  icpNumber?: string
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(SITE_LIMITS.icpUrl)
  icpUrl?: string
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(SITE_LIMITS.copyright)
  copyright?: string
}
