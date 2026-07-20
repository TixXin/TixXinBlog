/**
 * @file trace-id.ts
 * @description 请求级 traceId：优先透传上游 x-trace-id，否则生成并缓存到请求对象
 * @author TixXin
 * @since 2026-07-20
 */

import { randomUUID } from 'node:crypto'
import type { Request } from 'express'

const TRACE_KEY = Symbol('traceId')

interface TracedRequest extends Request {
  [TRACE_KEY]?: string
}

export function getTraceId(req: TracedRequest): string {
  if (req[TRACE_KEY]) return req[TRACE_KEY]
  const upstream = req.headers['x-trace-id']
  const traceId = typeof upstream === 'string' && upstream.trim() ? upstream.trim() : randomUUID()
  req[TRACE_KEY] = traceId
  return traceId
}
