/**
 * @file error-codes.ts
 * @description 统一业务错误码，与 docs/backend/api.md 附录 A 严格对齐
 * @author TixXin
 * @since 2026-07-20
 */

/** 通用错误码（0-99 段）；域错误码（1xxx+）随对应模块落地时补充 */
export enum ErrorCode {
  /** 成功 */
  Ok = 0,
  /** 参数校验失败 */
  ParamInvalid = 10,
  /** 参数缺失 */
  ParamMissing = 11,
  /** 参数格式错误 */
  ParamMalformed = 12,
  /** 未鉴权 */
  Unauthorized = 20,
  /** Access token 失效 */
  AccessTokenExpired = 21,
  /** Refresh token 失效 */
  RefreshTokenExpired = 22,
  /** 权限不足 */
  Forbidden = 23,
  /** IP 黑名单 */
  IpBlocked = 24,
  /** 资源不存在（通用） */
  NotFound = 30,
  /** 状态冲突 */
  Conflict = 40,
  /** 命中敏感词 */
  SensitiveWord = 50,
  /** 业务规则拒绝 */
  BusinessRejected = 51,
  /** 限流 */
  RateLimited = 60,
  /** 服务端异常 */
  ServerError = 90,
  /** 依赖不可用 */
  DependencyUnavailable = 91,
}

/** HTTP 状态码 → 通用错误码映射，用于未显式指定业务码的 HttpException */
export const HTTP_STATUS_TO_ERROR_CODE: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.ParamInvalid,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  422: ErrorCode.BusinessRejected,
  429: ErrorCode.RateLimited,
  500: ErrorCode.ServerError,
  503: ErrorCode.DependencyUnavailable,
}
