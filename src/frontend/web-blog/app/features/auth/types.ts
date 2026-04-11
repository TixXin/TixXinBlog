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

/** 当前登录用户信息（mock 阶段使用，未来由后端返回） */
export interface CurrentUser {
  /** 用户唯一标识 */
  id: string
  /** 显示昵称 */
  nickname: string
  /** 邮箱（用于展示） */
  email: string
  /** 头像 URL */
  avatar: string
  /** 用户角色：博主 / 普通访客 */
  role: 'owner' | 'visitor'
  /** 个性签名（可选） */
  signature?: string
}
