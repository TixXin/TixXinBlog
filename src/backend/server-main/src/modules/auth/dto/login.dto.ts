/**
 * @file login.dto.ts
 * @description POST /auth/login 请求体 DTO
 * @author TixXin
 * @since 2026-07-20
 */

import { IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string
}
