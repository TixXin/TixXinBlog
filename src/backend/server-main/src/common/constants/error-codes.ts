/**
 * @file error-codes.ts
 * @description 统一业务错误码，响应约定见 docs/api.md
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
  /** 记录版本或状态已变化，需重新读取后合并 */
  RevisionConflict = 41,
  /** 站点数据上下文已变化（内容代次轮换） */
  ContentContextChanged = 42,
  /** 站点数据已恢复，需要重新读取内容上下文 */
  ContentContextRestored = 43,
  /** 提交标识已处理或与原提交不一致 */
  SubmissionConflict = 44,
  /** 预览、导入计划或影响范围已变化，需要重新预览 */
  PreviewStale = 45,
  /** 执行期间登录会话已失效，操作未执行 */
  SessionChanged = 46,
  /** 资源仍被引用，不能删除或移除 */
  ResourceInUse = 47,
  /** 名称、地址等唯一值已被占用 */
  DuplicateResource = 48,
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
