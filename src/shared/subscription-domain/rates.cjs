/** @file rates.cjs @description 博主手填参考汇率的校验与换算；只用于标注“估算”的折合金额，从不参与分币种统计 */
'use strict'

const RATE_SCALE = 10n ** 8n
const RATE_PATTERN = /^(?:0|[1-9]\d{0,6})(?:\.\d{1,8})?$/
/** 汇率为“1 单位该币种折合多少基准币种”的十进制字符串，最多 8 位小数，必须大于 0 */
function parseRate(input) {
  if (typeof input !== 'string' || !RATE_PATTERN.test(input)) throw new RangeError('汇率格式无效')
  const [whole, fraction = ''] = input.split('.')
  const scaled = BigInt(whole) * RATE_SCALE + BigInt(fraction.padEnd(8, '0'))
  if (scaled <= 0n) throw new RangeError('汇率必须大于 0')
  return scaled
}
/**
 * 校验参考汇率配置：基准币种之外的每个币种可选填汇率；返回规范化副本。
 * digits 为币种小数位表，由调用方传入，避免与金额模块循环依赖。
 */
function validateRates(value, digits) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('汇率配置无效')
  if (!Object.hasOwn(digits, value.base)) throw new RangeError('基准币种无效')
  const rates = value.rates
  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) throw new RangeError('汇率配置无效')
  const normalized = {}
  for (const [currency, rate] of Object.entries(rates)) {
    if (!Object.hasOwn(digits, currency) || currency === value.base) throw new RangeError('汇率币种无效')
    parseRate(rate)
    normalized[currency] = rate
  }
  return { base: value.base, rates: normalized }
}
/** 把最小单位金额换算为基准币种最小单位（四舍五入）；缺少该币种汇率时返回 null */
function convertAmount(amount, currency, config, digits) {
  if (!config) return null
  if (currency === config.base) return amount
  const rate = config.rates?.[currency]
  if (!rate) return null
  const numerator = BigInt(amount) * parseRate(rate) * 10n ** BigInt(digits[config.base])
  const denominator = 10n ** BigInt(digits[currency]) * RATE_SCALE
  const value = (numerator * 2n + denominator) / (denominator * 2n)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('折合金额超出安全范围')
  return Number(value)
}

module.exports = { parseRate, validateRates, convertAmount }
