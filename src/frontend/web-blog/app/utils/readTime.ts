/**
 * @file readTime.ts
 * @description 文章预计阅读时长的界面显示：后端详情接口返回「12 分钟」形式的中文文本，
 *              这里提取分钟数后按当前界面语言重新组织；无法识别的文本原样显示
 * @author TixXin
 * @since 2026-10-19
 */
import type { Translate } from '~/utils/format'

/** 接受数字分钟或「N 分钟」文本，输出当前语言的时长文案 */
export function formatReadTime(readTime: string | number, t: Translate): string {
  const minutes = typeof readTime === 'number' ? readTime : Number(/^\s*(\d+)\s*分钟\s*$/.exec(readTime)?.[1])
  return Number.isFinite(minutes) ? t('article.readTime.minutes', { minutes }) : String(readTime)
}
