/** @file query-post-navigation.spec.ts @description 上下篇导航查询默认兼容全站，严格校验同专栏范围 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ValidationPipe } from '@nestjs/common'
import { QueryPostNavigationDto } from './query-post-navigation.dto'

describe('文章上下篇查询边界', () => {
  it('缺省范围保持全站导航', () => {
    const query = plainToInstance(QueryPostNavigationDto, {})
    expect(query.scope).toBe('all')
    expect(validateSync(query)).toEqual([])
  })

  it.each(['all', 'folder'])('接受明确范围 %s', (scope) => {
    const query = plainToInstance(QueryPostNavigationDto, { scope })
    expect(query.scope).toBe(scope)
    expect(validateSync(query)).toEqual([])
  })

  it.each([
    { scope: '' },
    { scope: 'category' },
    { scope: 'FOLDER' },
    { scope: ' folder ' },
    { scope: true },
    { scope: 1 },
    { scope: null },
    { scope: ['folder'] },
    { scope: ['all', 'folder'] },
  ])('非法范围通过共用校验规则返回 400：%j', async ({ scope }) => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    await expect(pipe.transform({ scope }, { type: 'query', metatype: QueryPostNavigationDto })).rejects.toMatchObject({
      status: 400,
    })
  })
})
