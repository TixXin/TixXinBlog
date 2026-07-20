/**
 * @file mikro-orm.config.ts
 * @description MikroORM CLI 入口配置，转发 src/config/mikro-orm.options.ts 的单一来源
 * @author TixXin
 * @since 2026-07-20
 */

import { mikroOrmOptions } from './src/config/mikro-orm.options'

// MikroORM CLI 约定读取默认导出，此文件豁免"禁用默认导出"规则
export default mikroOrmOptions
