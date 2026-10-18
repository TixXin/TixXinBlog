/** @file types.ts @description 公开访客表单的非持久化防垃圾字段 */
export interface VisitorSubmissionFields {
  website?: string
  /** 表单打开到提交经过的毫秒数，按客户端单调时钟计算 */
  formElapsedMs?: number
}
