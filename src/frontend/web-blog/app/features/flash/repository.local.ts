/**
 * @file repository.local.ts
 * @description FlashNoteRepository 的 LocalStorage 实现，mock 阶段使用
 * @author TixXin
 * @since 2026-04-11
 *
 * 存储 key：`flash:notes:${userId}`，value 为 JSON 数组。
 * 所有方法都是异步的（Promise），方便未来整体替换为 HTTP 实现而不用改调用方。
 * SSR 安全：在 typeof window === 'undefined' 时所有读返回空、写为 no-op。
 */

import type { FlashNoteRepository } from './repository'
import type { FlashNote, FlashNoteDraft } from './types'

const STORAGE_PREFIX = 'flash:notes:'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function readAll(userId: string): FlashNote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FlashNote[]) : []
  } catch {
    return []
  }
}

function writeAll(userId: string, notes: FlashNote[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(notes))
  } catch {
    // 容量超限或被禁用 → 静默失败，避免阻断 UI
  }
}

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class LocalFlashRepository implements FlashNoteRepository {
  list(userId: string): Promise<FlashNote[]> {
    const notes = readAll(userId)
    // 倒序：最新在前
    const sorted = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return Promise.resolve(sorted)
  }

  create(userId: string, draft: FlashNoteDraft): Promise<FlashNote> {
    const now = new Date().toISOString()
    const note: FlashNote = {
      id: generateId(),
      userId,
      content: draft.content,
      tags: [...draft.tags],
      createdAt: now,
      updatedAt: now,
    }
    const notes = readAll(userId)
    notes.push(note)
    writeAll(userId, notes)
    return Promise.resolve(note)
  }

  update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('LocalFlashRepository.update called on server'))
    }
    // 通过遍历所有 user key 找出 note 所在的存储分片
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const userId = key.slice(STORAGE_PREFIX.length)
      const notes = readAll(userId)
      const idx = notes.findIndex((n) => n.id === id)
      if (idx === -1) continue
      const original = notes[idx]!
      const next: FlashNote = {
        ...original,
        content: patch.content ?? original.content,
        tags: patch.tags ? [...patch.tags] : original.tags,
        updatedAt: new Date().toISOString(),
      }
      notes[idx] = next
      writeAll(userId, notes)
      return Promise.resolve(next)
    }
    return Promise.reject(new Error(`FlashNote ${id} not found`))
  }

  remove(id: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const userId = key.slice(STORAGE_PREFIX.length)
      const notes = readAll(userId)
      const filtered = notes.filter((n) => n.id !== id)
      if (filtered.length !== notes.length) {
        writeAll(userId, filtered)
        return Promise.resolve()
      }
    }
    return Promise.resolve()
  }

  search(userId: string, query: string): Promise<FlashNote[]> {
    const q = query.trim().toLowerCase()
    if (!q) return this.list(userId)
    const notes = readAll(userId)
    const hits = notes.filter((n) => {
      if (n.content.toLowerCase().includes(q)) return true
      return n.tags.some((t) => t.toLowerCase().includes(q))
    })
    return Promise.resolve(hits.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
  }
}
