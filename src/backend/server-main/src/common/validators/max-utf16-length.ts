/** @file max-utf16-length.ts @description 图库、项目和友链文本按UTF16单元限制，与内容包及HTML maxlength一致 */
import { buildMessage, ValidateBy } from 'class-validator'
import type { ValidationOptions } from 'class-validator'

export function MaxUtf16Length(max: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxUtf16Length',
      constraints: [max],
      validator: {
        validate: (value: unknown) => typeof value === 'string' && value.length <= max,
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be shorter than or equal to $constraint1 UTF-16 code units`,
          options,
        ),
      },
    },
    options,
  )
}
