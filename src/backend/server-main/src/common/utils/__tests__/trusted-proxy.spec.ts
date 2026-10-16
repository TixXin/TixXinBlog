/** @file trusted-proxy.spec.ts @description 真实 HTTP 验证连接地址、可信代理链和配额归属。 */
import 'reflect-metadata'
import { Controller, Get, Post, Req } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import type { Request } from 'express'
import { configureApplication } from '../../../bootstrap'
import { RateLimitGuard } from '../../guards/rate-limit.guard'
import { parseTrustedProxyCidrs } from '../trusted-proxy'

@Controller()
class ClientProbeController {
  @Get('posts') read(@Req() request: Request) {
    return { ip: request.ip, remoteAddress: request.socket.remoteAddress }
  }
  @Post('auth/login') login(@Req() request: Request) {
    return { ip: request.ip }
  }
}

async function createProbe(trustedProxyCidrs = '', host = '127.0.0.1'): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [ClientProbeController],
    providers: [
      {
        provide: ConfigService,
        useValue: new ConfigService({ TRUSTED_PROXY_CIDRS: trustedProxyCidrs, NODE_ENV: 'production' }),
      },
      { provide: APP_GUARD, useClass: RateLimitGuard },
    ],
  }).compile()
  const app = module.createNestApplication({ logger: false })
  configureApplication(app)
  await app.listen(0, host)
  return app
}

describe('可信代理地址', () => {
  it('只接受明确地址/CIDR，默认空列表不信任任何头', () => {
    expect(parseTrustedProxyCidrs(undefined)).toEqual([])
    expect(parseTrustedProxyCidrs('127.0.0.1, ::1/128, 192.0.2.0/24')).toHaveLength(3)
    for (const value of ['true', 'loopback', '*', '192.0.2.0/33', '::1/129', '127.0.0.1/-1', '1.2.3.4/8/1']) {
      expect(() => parseTrustedProxyCidrs(value)).toThrow('TRUSTED_PROXY_CIDRS')
    }
  })

  it('默认按连接 IP 限流，伪造头无法绕过登录配额', async () => {
    const app = await createProbe()
    try {
      const origin = await app.getUrl()
      for (let index = 0; index < 5; index++) {
        const result = await fetch(`${origin}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'x-forwarded-for': `192.0.2.${index + 1}` },
        })
        expect(result.status).toBe(201)
        expect(((await result.json()) as { data: { ip: string } }).data.ip).toBe('127.0.0.1')
      }
      const rejected = await fetch(`${origin}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.1' },
      })
      expect(rejected.status).toBe(429)
      expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  it('可信代理后按独立访客隔离，遇到第一个非可信跳点停止', async () => {
    const app = await createProbe('127.0.0.1/32,::1/128')
    try {
      const origin = await app.getUrl()
      for (let index = 0; index < 5; index++) {
        const result = await fetch(`${origin}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.1,192.0.2.1' },
        })
        expect(result.status).toBe(201)
        expect(((await result.json()) as { data: { ip: string } }).data.ip).toBe('192.0.2.1')
      }
      expect(
        (await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: { 'x-forwarded-for': '192.0.2.1' } }))
          .status,
      ).toBe(429)
      expect(
        (await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: { 'x-forwarded-for': '192.0.2.2' } }))
          .status,
      ).toBe(201)
      const read = await fetch(`${origin}/api/v1/posts`, { headers: { 'x-forwarded-for': '192.0.2.1' } })
      expect(read.status).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('IPv4 CIDR 正确识别双栈监听中的 IPv4-mapped IPv6 代理连接', async () => {
    const app = await createProbe('127.0.0.1/32', '::')
    try {
      const address = app.getHttpServer().address() as { port: number }
      const result = await fetch(`http://127.0.0.1:${address.port}/api/v1/posts`, {
        headers: { 'x-forwarded-for': '192.0.2.9' },
      })
      expect(result.status).toBe(200)
      expect(((await result.json()) as { data: { ip: string; remoteAddress: string } }).data).toEqual({
        ip: '192.0.2.9',
        remoteAddress: '::ffff:127.0.0.1',
      })
    } finally {
      await app.close()
    }
  })
})
