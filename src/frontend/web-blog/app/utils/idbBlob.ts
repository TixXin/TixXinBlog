/**
 * @file idbBlob.ts
 * @description 轻量 IndexedDB Blob 存储：把壁纸等大体积二进制文件放到独立 DB，避免挤占 localStorage 配额
 * @author TixXin
 * @since 2026-04-15
 */

const DB_NAME = 'tixxin-tab-assets'
const STORE = 'blobs'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function request<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = op(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function idbSet(key: string, blob: Blob): Promise<void> {
  return request('readwrite', (s) => s.put(blob, key)).then(() => void 0)
}

export function idbGet(key: string): Promise<Blob | null> {
  return request<Blob | undefined>('readonly', (s) => s.get(key)).then((v) => v ?? null)
}

export function idbDel(key: string): Promise<void> {
  return request('readwrite', (s) => s.delete(key)).then(() => void 0)
}

export function idbListKeys(): Promise<string[]> {
  return request<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then(
    (keys) => keys.map((k) => String(k)),
  )
}
