/**
 * @file useToast.ts
 * @description 简易全局 Toast 提示
 * @author TixXin
 * @since 2026-04-04
 */

export interface ToastOptions {
  id: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  duration: number
}

const toasts = ref<ToastOptions[]>([])

export function useToast() {
  function show(message: string, type: ToastOptions['type'] = 'info', duration = 3000) {
    const id = Math.random().toString(36).substring(2, 9)
    toasts.value.push({ id, message, type, duration })

    setTimeout(() => {
      remove(id)
    }, duration)
  }

  function success(message: string, duration?: number) {
    show(message, 'success', duration)
  }

  function info(message: string, duration?: number) {
    show(message, 'info', duration)
  }

  function warning(message: string, duration?: number) {
    show(message, 'warning', duration)
  }

  function error(message: string, duration?: number) {
    show(message, 'error', duration)
  }

  function remove(id: string) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    show,
    success,
    info,
    warning,
    error,
    remove,
  }
}
