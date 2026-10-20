/**
 * @file setup.dto.ts
 * @description 浏览器初始化向导请求体：令牌、登录名、密码，以及可选的站点与博主资料（名称、语言、简介、建站日期、
 *              博主名与头衔、联系邮箱、头像、社交链接、搜索引擎收录）
 * @author TixXin
 * @since 2026-10-19
 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { API_LOCALES, zh, type ApiLocale } from '../../common/i18n'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

/** 向导可填的社交图标：与站点资料一致，邮件由 email 字段单独生成 */
export const SETUP_SOCIAL_ICONS = [
  'lucide:github',
  'lucide:twitter',
  'lucide:globe',
  'lucide:link',
  'lucide:rss',
  'lucide:youtube',
  'lucide:linkedin',
] as const
/** 站点资料最多 8 条社交链接，留 1 条给联系邮箱 */
export const SETUP_SOCIAL_LIMIT = 7
/** 头像图片 data URL 上限：客户端裁成 512px 后远小于此值，JSON 请求体整体上限为 1MB */
export const SETUP_AVATAR_DATA_MAX = 900_000

class SetupSocialDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) label!: string
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) href!: string
  @IsIn(SETUP_SOCIAL_ICONS) icon!: string
}

export class SetupDto {
  /** 与环境变量 SETUP_TOKEN 比较；长度上限只为限制请求体，不提示令牌格式 */
  @IsString({ message: zh('setup.tokenInvalid') })
  @MaxLength(512, { message: zh('setup.tokenInvalid') })
  token!: string

  /** 与命令行初始化一致：去掉首尾空白后 1–64 个字符 */
  @Transform(trim)
  @IsString({ message: zh('setup.usernameInvalid') })
  @MinLength(1, { message: zh('setup.usernameInvalid') })
  @MaxLength(64, { message: zh('setup.usernameInvalid') })
  username!: string

  /** 不做 trim；长度规则由服务端复用 adminPasswordProblem 判定，上限仅防止超大请求体 */
  @IsString({ message: zh('setup.passwordMissing') })
  @MaxLength(1024, { message: zh('setup.passwordTooLong', { max: 128 }) })
  password!: string

  /** 与后台站点资料一致：去掉首尾空白后 1–80 个字符；省略时保留当前站点名称 */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  siteName?: string

  /** 站点语言；只用于把仍未编辑的初始博主资料改为对应语言，界面默认语言仍由部署环境决定 */
  @IsOptional()
  @IsIn(API_LOCALES)
  locale?: ApiLocale

  /** 站点简介（副标题），与后台站点资料一致最多 300 个字符 */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string

  /** 建站日期，驱动「站点已稳定运行 N 天」 */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: zh('setup.launchedAtInvalid') })
  launchedAt?: string

  /** 博主名；省略时沿用登录名 */
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) ownerName?: string

  /** 博主头衔或一句话简介 */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) ownerTitle?: string

  /** 公开联系邮箱：写成社交链接中的 mailto，也用于 Cravatar 头像 */
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: zh('setup.emailInvalid') })
  @MaxLength(254, { message: zh('setup.emailInvalid') })
  email?: string

  /**
   * 头像来源：image 为客户端裁切后的图片（本地上传或字母头像），以 data URL 提交并登记为站内媒体；
   * url 为外部图片地址，服务器不抓取；cravatar 按联系邮箱生成 Cravatar 地址
   */
  @IsOptional() @IsIn(['image', 'url', 'cravatar']) avatarSource?: 'image' | 'url' | 'cravatar'

  @IsOptional()
  @IsString()
  @MaxLength(SETUP_AVATAR_DATA_MAX, { message: zh('setup.avatarTooLarge') })
  avatarImage?: string

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) avatarUrl?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SETUP_SOCIAL_LIMIT)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SetupSocialDto)
  socials?: SetupSocialDto[]

  /** 是否允许搜索引擎收录；省略时保持站点当前设置 */
  @IsOptional() @IsBoolean() searchIndexing?: boolean
}
