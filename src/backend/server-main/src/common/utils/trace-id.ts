/**
 * @file trace-id.ts
 * @description 请求级 traceId：仅透传格式安全的上游 x-trace-id，否则生成 UUID 并缓存到请求对象
 * @author TixXin
 * @since 2026-07-20
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

const TRACE_KEY = Symbol('traceId')
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_TRACE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

type TracedRequest = IncomingMessage & { [TRACE_KEY]?: string }

/** 上游 traceId 只接受 UUID 或不超过 64 位的 [A-Za-z0-9._-]，防止日志注入与超长头污染。 */
export function normalizeTraceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (UUID_PATTERN.test(trimmed)) return trimmed.toLowerCase()
  return SAFE_TRACE_PATTERN.test(trimmed) ? trimmed : undefined
}

/** 同一请求只生成一次；日志 request.id、响应 traceId 与 X-Request-Id 均取自此处。 */
export function getTraceId(req: IncomingMessage): string {
  const traced = req as TracedRequest
  if (traced[TRACE_KEY]) return traced[TRACE_KEY]
  const traceId = normalizeTraceId(req.headers['x-trace-id']) ?? randomUUID()
  traced[TRACE_KEY] = traceId
  return traceId
}
