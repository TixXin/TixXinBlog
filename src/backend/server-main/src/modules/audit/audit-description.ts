/**
 * @file audit-description.ts
 * @description 固定管理动作与对象映射汇总；不把请求正文、密码、令牌或任意路径写入审计。
 *              动作与字段名走中英字典：写入审计的字段名保持中文，接口读取时按请求语言翻译。
 */
export * from './audit-actions'
export * from './audit-descriptor'
export * from './audit-fields'
export * from './audit-result'
