/**
 * @file password.ts
 * @description 初始化向导的密码规则：与后端 admin-cli 的 assertAdminPassword 一致（12–128 个字符，不做 trim）
 * @author TixXin
 * @since 2026-10-19
 */

export const SETUP_PASSWORD_MIN_LENGTH = 12
export const SETUP_PASSWORD_MAX_LENGTH = 128

/** 逐条判定密码要求，供表单实时提示；提交前仍以后端校验为准 */
export function setupPasswordChecks(password: string, confirmation: string) {
  return {
    length: password.length >= SETUP_PASSWORD_MIN_LENGTH && password.length <= SETUP_PASSWORD_MAX_LENGTH,
    match: password.length > 0 && password === confirmation,
  }
}
