/**
 * @file presence-time.ts
 * @description 访问统计按北京时间切日：只在后端计算日期，前端展示后端给出的数字，SSR 与客户端不会因时区不同而不一致。
 */

const BEIJING_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 返回北京时间的 YYYY-MM-DD */
export function beijingDay(date: Date): string {
  return BEIJING_DAY.format(date)
}
