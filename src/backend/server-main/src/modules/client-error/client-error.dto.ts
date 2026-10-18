/** @file client-error.dto.ts @description 公开客户端错误上报白名单及严格字段长度。 */
import { IsIn, IsString, IsUrl, Matches, ValidateIf } from 'class-validator'
import { MaxUtf16Length } from '../../common/validators/max-utf16-length'

export class ClientErrorDto {
  @IsIn(['vue', 'window', 'unhandledrejection'])
  source!: 'vue' | 'window' | 'unhandledrejection'

  @IsString()
  @Matches(/[^\s\p{Cc}\p{Cf}]/u)
  @MaxUtf16Length(1000)
  message!: string

  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxUtf16Length(2048)
  url!: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxUtf16Length(4000)
  stack?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxUtf16Length(200)
  info?: string
}
