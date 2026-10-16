/** @file publicReadCache.ts @description 按应用隔离的公开读取缓存：有界 LRU、有效期与写后代次隔离 */
export type PublicReadDomain =
  | 'posts'
  | 'post-summary'
  | 'archive'
  | 'gallery'
  | 'projects'
  | 'links'
  | 'prompts'
  | 'subscriptions'
  | 'moment-feed'
  | 'guestbook-feed'
  | 'moment-overview'
  | 'guestbook-metadata'

interface Entry {
  domain: PublicReadDomain
  value: unknown
  savedAt: number
  ttl: number
  bytes: number
}

/** 对象属性排序保证等价筛选命中；数组顺序保留业务语义。 */
export function publicReadKey(domain: PublicReadDomain, query: unknown = null): string {
  return `${domain}:${JSON.stringify(query, (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, value[key]]),
    )
  })}`
}

export function createPublicReadCache(options: { now?: () => number; maxEntries?: number; maxBytes?: number } = {}) {
  const now = options.now ?? (() => Date.now())
  const entries = new Map<string, Entry>()
  const generations = new Map<PublicReadDomain, number>()
  const listeners = new Map<PublicReadDomain, Set<() => void>>()
  const readers = new Map<string, number>()
  let bytes = 0
  const generation = (domain: PublicReadDomain) => generations.get(domain) ?? 0
  function remove(key: string) {
    const entry = entries.get(key)
    if (entry) bytes -= entry.bytes
    entries.delete(key)
  }
  function read<T>(key: string) {
    const entry = entries.get(key)
    if (!entry) return undefined
    const age = Math.max(0, now() - entry.savedAt)
    if (age > 300_000) {
      remove(key)
      return undefined
    }
    entries.delete(key)
    entries.set(key, entry)
    return { value: entry.value as T, stale: age >= entry.ttl }
  }
  function put<T>(
    domain: PublicReadDomain,
    key: string,
    value: T,
    expectedGeneration: number,
    ttl: number,
    additionalBytes = 0,
    readAt?: number,
  ) {
    if (generation(domain) !== expectedGeneration || value === undefined) return false
    if (!Number.isFinite(additionalBytes) || additionalBytes < 0) return false
    if (readAt !== undefined && !Number.isFinite(readAt)) return false
    let size: number
    try {
      size = new TextEncoder().encode(JSON.stringify(value)).byteLength + additionalBytes
    } catch {
      return false
    }
    remove(key)
    if (size > (options.maxBytes ?? 4 * 1024 * 1024)) return false
    // 组合分页同时沿用原始读取时刻计算新鲜期和五分钟上限，追加不能延长旧前缀寿命。
    const writtenAt = now()
    entries.set(key, { domain, value, bytes: size, savedAt: Math.min(readAt ?? writtenAt, writtenAt), ttl })
    bytes += size
    while (entries.size > (options.maxEntries ?? 32) || bytes > (options.maxBytes ?? 4 * 1024 * 1024)) {
      remove(entries.keys().next().value!)
    }
    return true
  }
  function invalidate(domains?: PublicReadDomain[]) {
    const selected = new Set(
      domains ?? [
        ...new Set([...generations.keys(), ...listeners.keys(), ...[...entries.values()].map((e) => e.domain)]),
      ],
    )
    for (const domain of selected) generations.set(domain, generation(domain) + 1)
    for (const [key, entry] of entries) if (selected.has(entry.domain)) remove(key)
    for (const domain of selected) for (const listener of listeners.get(domain) ?? []) listener()
  }
  function subscribe(domain: PublicReadDomain, listener: () => void) {
    generations.set(domain, generation(domain))
    if (!listeners.has(domain)) listeners.set(domain, new Set())
    listeners.get(domain)!.add(listener)
    return () => listeners.get(domain)?.delete(listener)
  }
  return {
    read,
    put,
    generation,
    invalidate,
    subscribe,
    retain(key: string) {
      readers.set(key, (readers.get(key) ?? 0) + 1)
    },
    release(key: string) {
      readers.set(key, Math.max(0, (readers.get(key) ?? 0) - 1))
    },
    readerCount: (key: string) => readers.get(key) ?? 0,
    size: () => ({ entries: entries.size, bytes }),
  }
}

const caches = new WeakMap<object, ReturnType<typeof createPublicReadCache>>()
export function publicReadCache(app: object) {
  if (!caches.has(app)) caches.set(app, createPublicReadCache())
  return caches.get(app)!
}
