/**
 * @file error-codes-documentation.spec.ts
 * @description 静态核对统一响应错误码与 API 文档，避免新增枚举或模块业务码后遗漏文档
 */
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ts from 'typescript'
import { ErrorCode, HTTP_STATUS_TO_ERROR_CODE } from '../error-codes'

const sourceRoot = resolve(__dirname, '../../..')
const documentationPath = resolve(sourceRoot, '../../../../docs/api.md')
const businessExceptionPath = resolve(sourceRoot, 'common/exceptions/business.exception.ts')

function documentedCodes() {
  const markdown = readFileSync(documentationPath, 'utf8')
  const sections = markdown.split('<!-- api-error-codes:start -->')
  expect(sections).toHaveLength(2)
  const ending = sections[1]!.split('<!-- api-error-codes:end -->')
  expect(ending).toHaveLength(2)

  const rows = ending[0]!.split('\n').filter((line) => /^\|\s*`\d+`\s*\|/.test(line))
  expect(rows.length).toBeGreaterThan(0)
  const codes = new Map<number, string>()
  for (const row of rows) {
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    expect(cells).toHaveLength(4)
    expect(cells.every(Boolean)).toBe(true)
    const code = Number(cells[0]!.replaceAll('`', ''))
    expect(codes.has(code)).toBe(false)
    codes.set(code, cells[2]!)
  }
  return codes
}

function businessCodes(additionalSource?: string) {
  // 只解析源码，不导入业务模块；关闭外部依赖解析，不启动应用或连接数据库。
  const files = ts.sys.readDirectory(sourceRoot, ['.ts'], ['**/*.spec.ts', '**/*.d.ts'])
  const options: ts.CompilerOptions = { noResolve: true, noLib: true, types: [] }
  const host = ts.createCompilerHost(options)
  if (additionalSource) {
    // 扫描器回归使用内存源码，避免往业务目录写入测试错误码。
    const fixturePath = resolve(sourceRoot, 'error-codes-documentation-fixture.ts')
    const getSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      fileName === fixturePath
        ? ts.createSourceFile(fileName, additionalSource, languageVersion, true)
        : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    files.push(fixturePath)
  }
  const program = ts.createProgram(files, options, host)
  const checker = program.getTypeChecker()
  const codes = new Set<number>()
  const unresolved: string[] = []
  let usages = 0

  for (const source of program.getSourceFiles()) {
    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) ||
        (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword)
      ) {
        // 按构造器声明定位，兼容别名导入，避免依赖调用处的拼写或格式。
        const declaration = checker.getResolvedSignature(node)?.declaration
        if (declaration?.getSourceFile().fileName === businessExceptionPath) {
          usages += 1
          const argument = node.arguments?.[0]
          const type = argument && checker.getTypeAtLocation(argument)
          const variants = type?.isUnion() ? type.types : type ? [type] : []
          // 字面量、模块常量、枚举和条件分支均需可枚举；未知表达式必须失败，不能静默漏过。
          if (!variants.length || variants.some((variant) => !(variant.flags & ts.TypeFlags.NumberLiteral))) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart())
            unresolved.push(
              `${relative(sourceRoot, source.fileName)}:${line + 1} ${argument?.getText() ?? '缺少错误码'}`,
            )
          } else {
            for (const variant of variants) codes.add((variant as ts.NumberLiteralType).value)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  expect(usages).toBeGreaterThan(0)
  expect(unresolved).toEqual([])
  return codes
}

describe('API 错误码文档', () => {
  it('扫描器识别字面量、导入别名、常量、条件分支和子类中的新错误码', () => {
    const codes = businessCodes(`
      import { BusinessException as ApiError } from './common/exceptions/business.exception'
      const DOMAIN_CODE = 9101
      declare const condition: boolean
      new ApiError(9100, '字面量')
      new ApiError(DOMAIN_CODE, '常量')
      new ApiError(condition ? 9102 : 9103, '条件分支')
      class DomainException extends ApiError {
        constructor() { super(9104, '子类') }
      }
      new DomainException()
    `)
    expect([...codes]).toEqual(expect.arrayContaining([9100, 9101, 9102, 9103, 9104]))
  })

  it('表格完整覆盖通用枚举、HTTP 映射和源码中的所有业务异常码', () => {
    const expected = new Set([
      ...Object.values(ErrorCode).filter((code): code is number => typeof code === 'number'),
      ...Object.values(HTTP_STATUS_TO_ERROR_CODE),
      ...businessCodes(),
    ])
    const documented = documentedCodes()
    const missing = [...expected].filter((code) => !documented.has(code)).sort((a, b) => a - b)
    const stale = [...documented.keys()].filter((code) => !expected.has(code)).sort((a, b) => a - b)
    expect({ missing, stale }).toEqual({ missing: [], stale: [] })
  })

  it('通用 HTTP 映射的状态均写在对应错误码行中', () => {
    const documented = documentedCodes()
    for (const [status, code] of Object.entries(HTTP_STATUS_TO_ERROR_CODE)) {
      expect(documented.get(code)?.match(/\b\d{3}\b/g)).toContain(status)
    }
  })
})
