/**
 * @file change-password.dto.ts
 * @description 改密输入，密码不做 trim，避免改变用户实际输入。
 */
import { IsString, MaxLength, MinLength } from 'class-validator'
import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from '../../../admin-cli'

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string
  // 与初始化向导、命令行初始化与重置共用同一长度规则
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) @MaxLength(ADMIN_PASSWORD_MAX_LENGTH) newPassword!: string
}
