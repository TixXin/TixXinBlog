/**
 * @file setup.dto.ts
 * @description 浏览器初始化向导请求体：令牌、登录名、密码与可选的站点名称和站点语言
 * @author TixXin
 * @since 2026-10-19
 */
import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { API_LOCALES, zh, type ApiLocale } from '../../common/i18n'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

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
}
