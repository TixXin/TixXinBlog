/**
 * @file md5.ts
 * @description UTF-8 字符串的 MD5 十六进制摘要，仅用于在初始化向导中预览 Cravatar 头像地址（与服务端算法一致）；
 *              不用于任何安全用途
 * @author TixXin
 * @since 2026-10-20
 */

const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
const CONSTANTS = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0)

export function md5(text: string): string {
  const bytes = new TextEncoder().encode(text)
  // 补位：追加 0x80，再补 0 至长度 ≡ 56 (mod 64)，最后 8 字节为小端位长
  const length = (((bytes.length + 8) >>> 6) + 1) * 64
  const buffer = new Uint8Array(length)
  buffer.set(bytes)
  buffer[bytes.length] = 0x80
  const view = new DataView(buffer.buffer)
  const bits = bytes.length * 8
  view.setUint32(length - 8, bits >>> 0, true)
  view.setUint32(length - 4, Math.floor(bits / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  for (let offset = 0; offset < length; offset += 64) {
    let a = a0
    let b = b0
    let c = c0
    let d = d0
    for (let index = 0; index < 64; index += 1) {
      const round = index >>> 4
      let f: number
      let word: number
      if (round === 0) {
        f = (b & c) | (~b & d)
        word = index
      } else if (round === 1) {
        f = (d & b) | (~d & c)
        word = (5 * index + 1) % 16
      } else if (round === 2) {
        f = b ^ c ^ d
        word = (3 * index + 5) % 16
      } else {
        f = c ^ (b | ~d)
        word = (7 * index) % 16
      }
      const sum = (a + f + CONSTANTS[index]! + view.getUint32(offset + word * 4, true)) >>> 0
      const shift = SHIFTS[round * 4 + (index % 4)]!
      a = d
      d = c
      c = b
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }
  const out = new DataView(new ArrayBuffer(16))
  ;[a0, b0, c0, d0].forEach((value, index) => out.setUint32(index * 4, value, true))
  return Array.from(new Uint8Array(out.buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
