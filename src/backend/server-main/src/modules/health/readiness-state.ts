/**
 * @file readiness-state.ts
 * @description 进程就绪状态：收到关闭信号后立即标记，/ready 返回 503 让编排器摘流，再继续原有关闭流程
 * @author TixXin
 * @since 2026-10-18
 */
import { Injectable } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'

@Injectable()
export class ReadinessState implements OnModuleDestroy {
  private shuttingDown = false
  private readonly listeners = new Map<NodeJS.Signals, () => void>()

  get isShuttingDown(): boolean {
    return this.shuttingDown
  }

  /** 关闭信号或应用关闭流程的第一步调用；幂等。 */
  markShuttingDown(): void {
    this.shuttingDown = true
  }

  /** 须在 enableShutdownHooks 之前调用，保证信号到达时先于 Nest 关闭钩子标记。 */
  watchSignals(signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']): void {
    for (const signal of signals) {
      if (this.listeners.has(signal)) continue
      const listener = () => this.markShuttingDown()
      this.listeners.set(signal, listener)
      process.once(signal, listener)
    }
  }

  /** 程序化 app.close() 不经过信号时也会标记，并移除本实例注册的信号监听。 */
  onModuleDestroy(): void {
    this.markShuttingDown()
    for (const [signal, listener] of this.listeners) process.removeListener(signal, listener)
    this.listeners.clear()
  }
}
