/**
 * @file site-settings.dto.ts
 * @description 站点资料字段与社交链接校验，图标限定为已支持的 Lucide 名称。
 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator'
import { AboutSettingsDto } from './about-settings'
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
  @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => SiteSocialDto) socials!: SiteSocialDto[]
  // 以下三项为后加字段，旧客户端与旧内容包可以不带；缺省按空串处理
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
}
