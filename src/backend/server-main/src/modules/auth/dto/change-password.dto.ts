/**
 * @file change-password.dto.ts
 * @description 改密输入，密码不做 trim，避免改变用户实际输入。
 */
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string
}
