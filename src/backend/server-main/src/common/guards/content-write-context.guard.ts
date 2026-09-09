/** @file content-write-context.guard.ts @description 公开留言写入也需校验恢复代次，防止旧页面向已恢复的同编号内容提交 */
import { CanActivate, ConflictException, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import type { Request } from 'express'
import { ContentContext } from '../../entities/content-context.entity'
@Injectable()
export class ContentWriteContextGuard implements CanActivate {
  constructor(private readonly em: EntityManager) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>()
    const content = await this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
    const supplied = request.headers['x-content-context']
    if (content.requireContext && !supplied)
      throw new HttpException('站点数据已恢复，请保留输入并刷新页面后重新读取', HttpStatus.PRECONDITION_REQUIRED)
    if (supplied && supplied !== content.generation)
      throw new ConflictException('站点数据上下文已变化，请保留输入并刷新页面后再提交')
    return true
  }
}
