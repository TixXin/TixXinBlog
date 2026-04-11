/**
 * @file types.ts
 * @description 认证模块类型定义：登录、注册、忘记密码
 * @author TixXin
 * @since 2026-04-10
 */

/** 认证视图类型 */
export type AuthView = 'login' | 'register' | 'forgot'

/** 登录表单 */
export interface LoginForm {
  email: string
  password: string
}

/** 注册表单 */
export interface RegisterForm {
  nickname: string
  email: string
  password: string
  confirmPassword: string
}

/** 忘记密码表单 */
export interface ForgotForm {
  email: string
}
