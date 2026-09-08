/**
 * @file postDifference.ts
 * @description 线性比较正文首尾共同区域，完整保留中间替换内容，避免长正文二次方计算。
 */
export function postDifference(before: string, after: string) {
  const original = before.split('\n')
  const revised = after.split('\n')
  let start = 0
  while (start < original.length && start < revised.length && original[start] === revised[start]) start += 1
  let end = 0
  while (
    end < original.length - start &&
    end < revised.length - start &&
    original[original.length - end - 1] === revised[revised.length - end - 1]
  )
    end += 1
  return {
    prefix: original.slice(0, start),
    removed: original.slice(start, original.length - end),
    added: revised.slice(start, revised.length - end),
    suffix: end ? original.slice(-end) : [],
  }
}
