/** @file number-from-string.ts @description DTO 仅转换非空白数字字符串，保留其他类型供整数校验拒绝。 */
export function numberFromString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : value
}
