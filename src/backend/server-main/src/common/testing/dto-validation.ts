/** @file dto-validation.ts @description DTO 单测共用真实转换与严格白名单校验，按字段路径断言具体约束。 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import type { ClassConstructor } from 'class-transformer'
import { validateSync } from 'class-validator'
import type { ValidationError } from 'class-validator'

/** 与 bootstrap 的全局 ValidationPipe 使用相同选项，不启用隐式类型转换。 */
export function dtoErrors<T extends object>(dto: ClassConstructor<T>, payload: object): ValidationError[] {
  return validateSync(plainToInstance(dto, payload), { whitelist: true, forbidNonWhitelisted: true })
}

export function expectDtoValid<T extends object>(dto: ClassConstructor<T>, payload: object): void {
  expect(dtoErrors(dto, payload)).toEqual([])
}

export function expectDtoInvalid<T extends object>(
  dto: ClassConstructor<T>,
  payload: object,
  path: string,
  constraint: string,
): void {
  let errors = dtoErrors(dto, payload)
  let error: ValidationError | undefined
  for (const part of path.split('.')) {
    error = errors.find((item) => item.property === part)
    errors = error?.children ?? []
  }
  expect(error?.constraints).toHaveProperty(constraint)
}
